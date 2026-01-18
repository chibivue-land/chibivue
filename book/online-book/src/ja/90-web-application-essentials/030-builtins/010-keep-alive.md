# KeepAlive

## KeepAlive とは

`<KeepAlive>` は，コンポーネントのインスタンスを破棄せずにキャッシュして再利用するための組み込みコンポーネントです．通常，コンポーネントが切り替わると古いコンポーネントはアンマウントされ，状態が失われますが，KeepAlive を使用することでコンポーネントの状態を保持したまま表示を切り替えることができます．

<KawaikoNote variant="question" title="なぜ KeepAlive が必要？">

例えばタブ切り替えのある画面で，入力中のフォームがあるタブから別のタブに移動して戻ってきたとき，
入力内容が消えてしまったら困りますよね．KeepAlive はそんな「状態を保持したい」というニーズに応えます！

</KawaikoNote>

主なユースケース：

1. **タブ切り替え**: フォーム入力中にタブを切り替えても入力内容を保持
2. **ルーティング**: ページ遷移時にスクロール位置や入力状態を保持
3. **パフォーマンス**: 頻繁に切り替わるコンポーネントの再レンダリングを回避

## 基本的な使い方

```vue
<template>
  <KeepAlive>
    <component :is="currentTab" />
  </KeepAlive>
</template>
```

## 実装の概要

### Props の定義

```ts
export interface KeepAliveProps {
  include?: MatchPattern;
  exclude?: MatchPattern;
  max?: number | string;
}

type MatchPattern = string | RegExp | (string | RegExp)[];
```

- **include**: キャッシュ対象のコンポーネント名（含まれるもののみキャッシュ）
- **exclude**: キャッシュ対象外のコンポーネント名（含まれるものはキャッシュしない）
- **max**: キャッシュする最大数（LRU アルゴリズムで古いものから削除）

### KeepAliveContext

KeepAlive コンポーネントは，レンダラーとやり取りするための特別なコンテキストを持ちます．

```ts
export interface KeepAliveContext extends ComponentInternalInstance {
  renderer: KeepAliveRenderer;
  activate: (
    vnode: VNode,
    container: any,
    anchor: any | null,
    parentComponent: ComponentInternalInstance | null,
  ) => void;
  deactivate: (vnode: VNode) => void;
}
```

- **activate**: キャッシュされたコンポーネントを表示に戻す
- **deactivate**: コンポーネントを非表示にしてキャッシュする

## コアロジックの実装

### キャッシュの管理

```ts
const cache: Map<any, VNode> = new Map();
const keys: Set<any> = new Set();
let current: VNode | null = null;

// 非アクティブなコンポーネントを格納するための隠しコンテナ
const storageContainer = instance.renderer.o.createElement("div");
```

KeepAlive は，`cache` Map を使ってコンポーネントの VNode をキャッシュします．`keys` Set は LRU（Least Recently Used）アルゴリズムのための順序管理に使用されます．

### activate 関数

キャッシュからコンポーネントを復元して表示します．

```ts
instance.activate = (vnode, container, anchor, _parentComponent) => {
  const instance = vnode.component!;
  // 隠しコンテナから実際のコンテナへ移動
  move(vnode, container, anchor);
  // props の変更があれば反映
  patch(instance.vnode, vnode, container, anchor, parentComponent);
  queuePostFlushCb(() => {
    instance.isDeactivated = false;
    // onActivated フックを呼び出す
    if (instance.a) {
      instance.a.forEach((hook: () => void) => hook());
    }
  });
};
```

ポイント：
1. 隠しコンテナからターゲットコンテナへ DOM を移動
2. props の変更を patch で適用
3. `onActivated` ライフサイクルフックを呼び出し

### deactivate 関数

コンポーネントを非表示にしてキャッシュします．

```ts
instance.deactivate = (vnode: VNode) => {
  // 隠しコンテナへ移動（DOM は削除されない）
  move(vnode, storageContainer, null);
  queuePostFlushCb(() => {
    const instance = vnode.component!;
    // onDeactivated フックを呼び出す
    if (instance.da) {
      instance.da.forEach((hook: () => void) => hook());
    }
    instance.isDeactivated = true;
  });
};
```

通常のアンマウントと異なり，DOM 要素は削除されず隠しコンテナに移動されるだけです．

<KawaikoNote variant="funny" title="隠しコンテナのトリック">

非表示にするコンポーネントは画面外の「隠れ家」に移動させておきます．
必要になったら「隠れ家」から取り出すだけなので，再構築の手間が省けます！

</KawaikoNote>

### render 関数

KeepAlive の核となるロジックです．

```ts
return (): VNode | undefined => {
  if (!slots.default) {
    return undefined;
  }

  const children = slots.default();
  const rawVNode = children[0];

  // 複数の子がある場合はキャッシュしない
  if (children.length > 1) {
    current = null;
    return children as unknown as VNode;
  }

  // コンポーネントでない場合はそのまま返す
  if (
    !(rawVNode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) &&
    !(rawVNode.shapeFlag & ShapeFlags.COMPONENT)
  ) {
    current = null;
    return rawVNode;
  }

  let vnode = rawVNode;
  const comp = vnode.type as any;
  const name = getComponentName(comp);
  const { include, exclude, max } = props;

  // include/exclude のフィルタリング
  if (
    (include && (!name || !matches(include, name))) ||
    (exclude && name && matches(exclude, name))
  ) {
    current = vnode;
    return rawVNode;
  }

  // キャッシュキーの決定
  const key = vnode.key == null ? comp : vnode.key;
  const cachedVNode = cache.get(key);

  if (cachedVNode) {
    // キャッシュがある場合：状態を復元
    vnode.el = cachedVNode.el;
    vnode.component = cachedVNode.component;
    vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE;
    // LRU: 最近使用したので順序を更新
    keys.delete(key);
    keys.add(key);
  } else {
    // 新規キャッシュ
    keys.add(key);
    // max を超えたら最も古いものを削除
    if (max && keys.size > parseInt(max as string, 10)) {
      pruneCacheEntry(keys.values().next().value);
    }
  }

  // フラグを設定してレンダラーに KeepAlive を認識させる
  vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
  current = vnode;
  return vnode;
};
```

### ShapeFlags による制御

KeepAlive は ShapeFlags を使用してレンダラーと連携します．

```ts
// このコンポーネントは KeepAlive で管理されるべき
vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;

// このコンポーネントはキャッシュから復元された
vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE;
```

レンダラーはこれらのフラグを見て，通常のマウント/アンマウントの代わりに activate/deactivate を呼び出します．

### include/exclude のマッチング

```ts
function matches(pattern: MatchPattern, name: string): boolean {
  if (isArray(pattern)) {
    return pattern.some((p: string | RegExp) => matches(p, name));
  } else if (isString(pattern)) {
    return pattern.split(",").includes(name);
  } else if (pattern instanceof RegExp) {
    return pattern.test(name);
  }
  return false;
}
```

パターンは以下の形式をサポート：
- 文字列（カンマ区切り）: `"ComponentA,ComponentB"`
- 正規表現: `/^Tab/`
- 配列: `["ComponentA", /^Tab/]`

### キャッシュのプルーニング

```ts
function pruneCacheEntry(key: any): void {
  const cached = cache.get(key) as VNode;
  // 現在表示中でなければアンマウント
  if (!current || !isSameVNodeType(cached, current)) {
    unmount(cached);
  } else if (current) {
    // 表示中の場合はフラグのみリセット
    resetShapeFlag(current);
  }
  cache.delete(key);
  keys.delete(key);
}

function resetShapeFlag(vnode: VNode): void {
  vnode.shapeFlag &= ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
  vnode.shapeFlag &= ~ShapeFlags.COMPONENT_KEPT_ALIVE;
}
```

## ライフサイクルフック

KeepAlive で管理されるコンポーネントは，追加のライフサイクルフックを使用できます：

- **onActivated**: コンポーネントがアクティブになったとき
- **onDeactivated**: コンポーネントが非アクティブになったとき

```ts
import { onActivated, onDeactivated } from 'vue'

export default {
  setup() {
    onActivated(() => {
      console.log('activated!')
    })
    onDeactivated(() => {
      console.log('deactivated!')
    })
  }
}
```

## 使用例

### 基本的な使用

```vue
<template>
  <KeepAlive>
    <component :is="currentComponent" />
  </KeepAlive>
</template>
```

### include/exclude の使用

```vue
<template>
  <!-- ComponentA と ComponentB のみキャッシュ -->
  <KeepAlive include="ComponentA,ComponentB">
    <component :is="currentComponent" />
  </KeepAlive>

  <!-- ComponentC 以外をキャッシュ -->
  <KeepAlive exclude="ComponentC">
    <component :is="currentComponent" />
  </KeepAlive>

  <!-- 正規表現でマッチ -->
  <KeepAlive :include="/^Tab/">
    <component :is="currentComponent" />
  </KeepAlive>
</template>
```

### max の使用

```vue
<template>
  <!-- 最大 10 コンポーネントまでキャッシュ（LRU） -->
  <KeepAlive :max="10">
    <component :is="currentComponent" />
  </KeepAlive>
</template>
```

## レンダラーとの連携

KeepAlive はレンダラーと密接に連携して動作します．

### mountComponent での KeepAlive 検出

```ts
// packages/runtime-core/src/renderer.ts
const mountComponent: MountComponentFn = (initialVNode, container, anchor, parentComponent) => {
  const instance: ComponentInternalInstance = (
    initialVNode.component = createComponentInstance(initialVNode, parentComponent)
  );

  // KeepAlive コンポーネントの場合、renderer を注入
  if (isKeepAlive(initialVNode)) {
    (instance as KeepAliveContext).renderer = {
      p: patch,   // パッチ関数
      m: move,    // DOM 移動関数
      um: unmount, // アンマウント関数
      o: options,  // ホストオプション（createElement 等）
    };
  }

  // ... 通常のマウント処理
};
```

### processComponent での KEPT_ALIVE 判定

```ts
const processComponent = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null = null,
) => {
  if (n1 == null) {
    // 新規マウント
    if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
      // キャッシュから復元：activate を呼び出す
      (parentComponent as KeepAliveContext).activate(
        n2,
        container,
        anchor,
        parentComponent as ComponentInternalInstance
      );
    } else {
      // 通常のマウント
      mountComponent(n2, container, anchor, parentComponent);
    }
  } else {
    updateComponent(n1, n2);
  }
};
```

### unmount での SHOULD_KEEP_ALIVE 判定

```ts
const unmount: UnmountFn = (vnode, parentComponent?: ComponentInternalInstance) => {
  const { type, shapeFlag, children } = vnode;

  // KeepAlive 管理下のコンポーネントは削除せず deactivate
  if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
    (parentComponent as KeepAliveContext).deactivate(vnode);
    return;
  }

  // 通常のアンマウント処理
  if (shapeFlag & ShapeFlags.COMPONENT) {
    unmountComponent(vnode.component!);
  }
  // ...
};
```

## 処理フロー

```
初回マウント:
KeepAlive render
  → slot から子を取得
  → cache に存在しない → keys に追加
  → COMPONENT_SHOULD_KEEP_ALIVE フラグ設定
  → vnode を返却
      ↓
processComponent
  → COMPONENT_KEPT_ALIVE なし → mountComponent
  → isKeepAlive(vnode) → renderer を注入
  → 通常のコンポーネントマウント

キャッシュからの復元:
KeepAlive render
  → slot から子を取得
  → cache にヒット → el/component を再利用
  → COMPONENT_KEPT_ALIVE フラグ追加
  → keys の順序を更新（LRU）
  → vnode を返却
      ↓
processComponent
  → COMPONENT_KEPT_ALIVE あり
  → parentComponent.activate() 呼び出し
      ↓
activate
  → move で隠しコンテナから実コンテナへ移動
  → patch で props の変更を適用
  → instance.isDeactivated = false
  → onActivated フック呼び出し

非アクティブ化:
unmount
  → COMPONENT_SHOULD_KEEP_ALIVE あり
  → parentComponent.deactivate() 呼び出し
      ↓
deactivate
  → move で隠しコンテナへ移動（DOM は削除されない）
  → instance.isDeactivated = true
  → onDeactivated フック呼び出し
  → cache に保持されたまま
```

<KawaikoNote variant="warning" title="メモリ使用量に注意！">

KeepAlive でキャッシュされたコンポーネントはメモリに残り続けます．
キャッシュしすぎるとメモリを圧迫するので，`max` プロパティで上限を設定しましょう．
LRU（最近使われていないものから削除）で自動的に管理されます！

</KawaikoNote>

## まとめ

KeepAlive の実装は以下の要素で構成されています：

1. **キャッシュシステム**: Map と Set を使用した LRU キャッシュ
2. **隠しコンテナ**: 非アクティブな DOM を保持（`createElement("div")`）
3. **activate/deactivate**: DOM の移動とライフサイクル管理
4. **ShapeFlags**: レンダラーとの連携
   - `COMPONENT_SHOULD_KEEP_ALIVE`: unmount 時に deactivate を呼び出す
   - `COMPONENT_KEPT_ALIVE`: mount 時に activate を呼び出す
5. **renderer 注入**: KeepAlive は patch/move/unmount 関数への参照を保持
6. **include/exclude/max**: 柔軟なキャッシュ制御

KeepAlive はコンポーネントの状態を保持しながらパフォーマンスを向上させる強力な機能ですが，メモリ使用量とのトレードオフがあるため，適切な `max` 値の設定が重要です．

<KawaikoNote variant="surprise" title="KeepAlive 完成！">

コンポーネントを「消さずに隠す」というシンプルなアイデアですが，
レンダラーとの連携や LRU キャッシュなど，実装はなかなか奥深いですね！

</KawaikoNote>

ここまでのソースコード:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/020_keep_alive)
