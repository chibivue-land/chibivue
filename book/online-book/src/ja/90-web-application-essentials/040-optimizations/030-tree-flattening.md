# Tree Flattening（Block Tree）

## Tree Flattening とは

Tree Flattening（Block Tree）は，Vue 3 で導入された高度な最適化テクニックです．テンプレート内の動的なノードを「フラット化」して収集し，更新時にツリー全体を走査する代わりに，動的なノードだけを直接更新します．

<KawaikoNote variant="question" title="なぜ「平坦化」？">

従来の Virtual DOM は，更新時にツリー全体を再帰的に走査する必要がありました．
Tree Flattening は，動的なノードだけを配列に「平坦化」して収集することで，
ネストされた構造を無視して直接アクセスできるようにします．

</KawaikoNote>

## 従来の diff アルゴリズムの問題

### テンプレート例

```vue
<template>
  <div>
    <header>
      <h1>Static Title</h1>
      <nav>
        <a href="/home">Home</a>
        <a href="/about">About</a>
      </nav>
    </header>
    <main>
      <p>{{ dynamicText }}</p>  <!-- 唯一の動的部分 -->
    </main>
    <footer>
      <p>Copyright 2024</p>
    </footer>
  </div>
</template>
```

### 従来のアプローチ

```
ツリー全体を走査:
div
├── header (静的)
│   ├── h1 (静的)
│   └── nav (静的)
│       ├── a (静的)
│       └── a (静的)
├── main
│   └── p (動的) ← 実際に更新が必要なのはここだけ
└── footer (静的)
    └── p (静的)

→ 9つのノードを走査して，1つを更新
```

### Tree Flattening のアプローチ

```
動的ノードのみを収集:
dynamicChildren = [p]

→ 1つのノードを直接更新
```

<KawaikoNote variant="funny" title="劇的な効率化！">

1000 個のノードのうち 10 個だけが動的な場合，
従来は 1000 回の比較が必要ですが，
Tree Flattening なら 10 回の比較で済みます．

</KawaikoNote>

## Block の概念

### Block とは

Block は「安定した構造を持つ VNode のサブツリー」です．Block 内では以下が保証されます：

1. 子ノードの数が変わらない
2. 子ノードの順序が変わらない
3. 構造的ディレクティブ（`v-if`, `v-for`）がない

### Block を作成する要素

以下の要素は新しい Block を作成します：

- ルート要素
- `v-if` の各分岐
- `v-for` の各アイテム
- コンポーネント

```vue
<template>
  <!-- Block 1: ルート -->
  <div>
    <p>{{ text1 }}</p>

    <!-- Block 2: v-if -->
    <div v-if="show">
      <p>{{ text2 }}</p>
    </div>

    <!-- Block 3, 4, ...: v-for の各アイテム -->
    <div v-for="item in items" :key="item.id">
      <p>{{ item.text }}</p>
    </div>
  </div>
</template>
```

## VNode の拡張

### dynamicChildren

VNode に `dynamicChildren` プロパティを追加して，動的な子ノードを収集します．

```ts
export interface VNode {
  // ... 既存のプロパティ

  /**
   * Block 内の動的な子ノードのリスト
   * 更新時にこれだけを走査すれば良い
   */
  dynamicChildren: VNode[] | null;

  /**
   * パッチ処理の最適化ヒント
   */
  patchFlag: number;

  /**
   * 動的なプロパティの名前リスト
   */
  dynamicProps: string[] | null;
}
```

## openBlock と createBlock

### Block のトラッキング

Block の作成は `openBlock` と `createBlock` のペアで行います．

```ts
// 現在トラッキング中の Block
let currentBlock: VNode[] | null = null;

export function openBlock(): void {
  currentBlock = [];
}

export function createBlock(
  type: VNodeTypes,
  props?: VNodeProps | null,
  children?: VNodeChildren,
  patchFlag?: number,
  dynamicProps?: string[]
): VNode {
  const vnode = createVNode(type, props, children, patchFlag, dynamicProps);

  // 収集した動的ノードを設定
  vnode.dynamicChildren = currentBlock;
  currentBlock = null;

  return vnode;
}
```

### 動的ノードの収集

`createVNode` 内で，patchFlag がある VNode を currentBlock に追加します．

```ts
export function createVNode(
  type: VNodeTypes,
  props?: VNodeProps | null,
  children?: VNodeChildren,
  patchFlag?: number,
  dynamicProps?: string[]
): VNode {
  const vnode: VNode = {
    type,
    props,
    children,
    patchFlag: patchFlag || 0,
    dynamicProps: dynamicProps || null,
    dynamicChildren: null,
    // ...
  };

  // patchFlag がある = 動的なノード
  // currentBlock があれば追加
  if (patchFlag !== undefined && patchFlag > 0 && currentBlock) {
    currentBlock.push(vnode);
  }

  return vnode;
}
```

## 生成されるコード

### テンプレート

```vue
<template>
  <div>
    <h1>Static Title</h1>
    <p>{{ message }}</p>
    <span :class="cls">{{ text }}</span>
  </div>
</template>
```

### 生成されるレンダリング関数

```js
import { openBlock, createBlock, createVNode, toDisplayString } from 'vue'

// 静的ノードは外部に巻き上げ
const _hoisted_1 = createVNode("h1", null, "Static Title")

function render(_ctx) {
  return (
    openBlock(),
    createBlock("div", null, [
      _hoisted_1,  // 静的（dynamicChildren に含まれない）
      createVNode("p", null, toDisplayString(_ctx.message), 1 /* TEXT */),
      createVNode("span", { class: _ctx.cls }, toDisplayString(_ctx.text), 3 /* TEXT | CLASS */)
    ])
  )
}

// 結果の VNode:
// {
//   type: "div",
//   children: [_hoisted_1, p, span],
//   dynamicChildren: [p, span]  // 動的ノードのみ
// }
```

## patchBlockChildren の実装

Block の更新時は `dynamicChildren` のみを走査します．

```ts
function patchBlockChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: RendererElement,
  parentComponent: ComponentInternalInstance | null
): void {
  for (let i = 0; i < newChildren.length; i++) {
    const oldVNode = oldChildren[i];
    const newVNode = newChildren[i];

    // 動的ノードのみをパッチ
    patch(oldVNode, newVNode, container, null, parentComponent);
  }
}
```

### patchElement での使用

```ts
function patchElement(
  n1: VNode,
  n2: VNode,
  parentComponent: ComponentInternalInstance | null
): void {
  const el = (n2.el = n1.el!);
  const oldProps = n1.props || {};
  const newProps = n2.props || {};

  // patchFlag を使った最適化されたパッチ
  const { patchFlag, dynamicChildren } = n2;

  if (patchFlag > 0) {
    // patchFlag に基づいて特定のプロパティのみ更新
    if (patchFlag & PatchFlags.CLASS) {
      patchClass(el, newProps.class);
    }
    if (patchFlag & PatchFlags.STYLE) {
      patchStyle(el, oldProps.style, newProps.style);
    }
    if (patchFlag & PatchFlags.TEXT) {
      if (n1.children !== n2.children) {
        el.textContent = n2.children as string;
      }
    }
    // ...
  }

  // dynamicChildren がある場合は最適化パス
  if (dynamicChildren) {
    patchBlockChildren(
      n1.dynamicChildren!,
      dynamicChildren,
      el,
      parentComponent
    );
  } else {
    // フォールバック: 通常の子要素パッチ
    patchChildren(n1, n2, el, parentComponent);
  }
}
```

## 最適化の効果

1000 個のリストアイテムのうち，1 つだけを更新するケースを考えると：

- **フル diff**: 1000 個以上のノードを走査
- **Patch Flags のみ**: 1000 個のノードを走査（プロパティ比較は最適化）
- **Tree Flattening**: 動的なノード（1 個）のみを走査

このように，動的ノードが少ないほど Tree Flattening の効果は大きくなります．

## Block が壊れるケース

以下のケースでは Block 最適化が無効になります（BAIL モード）：

1. **構造的ディレクティブ**: `v-if`, `v-for` は新しい Block を作成
2. **動的コンポーネント**: `<component :is="...">`
3. **スロットの出口**: `<slot />`

```vue
<template>
  <div>
    <!-- ここで Block が分割される -->
    <div v-if="show">
      <p>{{ a }}</p>  <!-- Block A の dynamicChildren -->
    </div>
    <div v-else>
      <p>{{ b }}</p>  <!-- Block B の dynamicChildren -->
    </div>
  </div>
</template>
```

## Static Hoisting との連携

Tree Flattening は Static Hoisting と組み合わせることで最大の効果を発揮します．

```ts
// 静的ノードは巻き上げられ，dynamicChildren に含まれない
const _hoisted_1 = createVNode("header", null, [
  createVNode("h1", null, "Title"),
  createVNode("nav", null, [/* ... */])
]);

function render() {
  return (
    openBlock(),
    createBlock("div", null, [
      _hoisted_1,  // 静的: スキップ
      createVNode("p", null, toDisplayString(msg), 1 /* TEXT */)  // 動的: 追跡
    ])
  )
}
```

1. **Static Hoisting**: 静的ノードを関数外に巻き上げ（VNode 生成をスキップ）
2. **Tree Flattening**: 動的ノードのみを収集（diff 対象を限定）
3. **Patch Flags**: 動的プロパティのみを更新（プロパティ比較を最適化）

## 処理フロー

```
[コンパイル時]
テンプレート解析
  ↓
静的ノードの検出 → Static Hoisting
  ↓
動的ノードの検出 → Patch Flags 付与
  ↓
Block 境界の特定 → openBlock/createBlock 挿入

[実行時]
openBlock() → currentBlock = []
  ↓
createVNode (静的) → currentBlock に追加しない
  ↓
createVNode (動的) → currentBlock.push(vnode)
  ↓
createBlock() → vnode.dynamicChildren = currentBlock

[更新時]
patchElement(n1, n2)
  ↓
n2.dynamicChildren が存在？
  ↓ Yes
patchBlockChildren(n1.dynamicChildren, n2.dynamicChildren)
  ↓
動的ノードのみをパッチ
```

## まとめ

Tree Flattening（Block Tree）の実装は以下の要素で構成されています：

1. **dynamicChildren**: 動的な子ノードを収集する配列
2. **openBlock / createBlock**: Block の作成とトラッキング
3. **patchBlockChildren**: 動的ノードのみをパッチ
4. **Block 境界の管理**: `v-if`, `v-for` などで新しい Block を作成

この最適化により，Vue 3 は大規模なアプリケーションでも高速な更新を実現しています．Static Hoisting と Patch Flags と組み合わせることで，テンプレートベースのフレームワークならではの最適化が可能になっています．
