# Hydration（ハイドレーション）

## Hydration とは

前章で，`renderToString` を使って Vue コンポーネントを HTML 文字列にレンダリングする方法を学びました．しかし，SSR で生成された HTML は単なる静的なマークアップであり，イベントハンドラーやリアクティビティは機能しません．

Hydration（ハイドレーション）は，サーバーで生成された HTML を「活性化」し，クライアントサイドの Vue アプリケーションとして機能させるプロセスです．

<KawaikoNote variant="question" title="なぜ「水分補給」？">

Hydration（水分補給）という名前は，静的な HTML に「命を吹き込む」イメージから来ています．
乾燥した植物に水を与えると生き生きとするように，静的な HTML にイベントハンドラーやリアクティビティを注入します．

</KawaikoNote>

## 通常のマウントとの違い

### 通常の `createApp`

```
1. VNode を生成
2. DOM 要素を新規作成
3. DOM をコンテナに挿入
```

### `createSSRApp`（Hydration）

```
1. VNode を生成
2. 既存の DOM 要素を走査
3. VNode と DOM 要素を関連付け
4. イベントハンドラーをアタッチ
```

<KawaikoNote variant="funny" title="Hydration の本質">

Hydration は「DOM を作らない render」とも言えます．
既存の DOM があるので，それを VNode と関連付けるだけで良いのです．

</KawaikoNote>

## 型定義

### HydrateOptions

Hydration に必要なオプションを定義します．

```ts
// runtime-core/hydration.ts
export interface HydrateOptions {
  patchProp: (el: Element, key: string, prevValue: any, nextValue: any) => void;
  nextSibling: (node: Node) => Node | null;
}
```

- `patchProp`: プロパティ（特にイベントハンドラー）を DOM 要素にアタッチするための関数
- `nextSibling`: DOM ツリーを走査するための関数

## createHydrationRenderer の実装

### 基本構造

```ts
// runtime-core/hydration.ts
export function createHydrationRenderer(options: HydrateOptions) {
  const { patchProp, nextSibling } = options;

  function hydrate(vnode: VNode, container: Element): void {
    const node = container.firstChild;
    if (node) {
      hydrateNode(node, vnode, null);
    }
  }

  // ... その他の関数

  return { hydrate };
}
```

`hydrate` 関数は，コンテナの最初の子ノードから始めて，VNode ツリーと DOM ツリーを並行して走査します．

### hydrateNode - ノードの種類による分岐

```ts
function hydrateNode(
  node: Node,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): Node | null {
  const { type, shapeFlag } = vnode;

  // 重要: VNode と DOM 要素を関連付け
  vnode.el = node;

  if (type === Text) {
    // テキストノード: 次の兄弟を返す
    return nextSibling(node);
  } else if (type === Comment) {
    // コメントノード: 次の兄弟を返す
    return nextSibling(node);
  } else if (type === Fragment) {
    // Fragment: 特別な処理
    return hydrateFragment(node, vnode, parentComponent);
  } else if (shapeFlag & ShapeFlags.ELEMENT) {
    // HTML 要素: 子要素も処理
    return hydrateElement(node as Element, vnode, parentComponent);
  }

  return nextSibling(node);
}
```

ポイント：
- `vnode.el = node` が最も重要な処理．これにより，後続の更新で VNode が正しい DOM 要素を参照できます
- 各関数は「次に処理すべき DOM ノード」を返します

### hydrateElement - HTML 要素のハイドレーション

```ts
function hydrateElement(
  el: Element,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): Node | null {
  vnode.el = el;

  const { props, children, shapeFlag } = vnode;

  // イベントハンドラーをアタッチ
  if (props) {
    for (const key in props) {
      if (key.startsWith("on") && typeof props[key] === "function") {
        patchProp(el, key, null, props[key]);
      }
    }
  }

  // 子要素のハイドレーション
  if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    hydrateChildren(el.firstChild, children as VNode[], parentComponent);
  }

  return nextSibling(el);
}
```

<KawaikoNote variant="warning" title="イベントハンドラーのみをアタッチ">

Hydration 時に処理するのはイベントハンドラー（`on` で始まる props）だけです．
`class` や `style` などの属性は既に SSR で HTML に含まれているため，アタッチ不要です．

</KawaikoNote>

### hydrateChildren - 子要素の処理

```ts
function hydrateChildren(
  node: Node | null,
  children: VNode[],
  parentComponent: ComponentInternalInstance | null,
): Node | null {
  for (let i = 0; i < children.length; i++) {
    const child = normalizeVNode(children[i]);
    if (node) {
      node = hydrateNode(node, child, parentComponent);
    }
  }
  return node;
}
```

VNode の children と DOM の子ノードを順番に処理していきます．各 `hydrateNode` は次の兄弟ノードを返すので，それを使って走査を続けます．

### hydrateFragment - Fragment の処理

SSR では Fragment は `<!--[-->` と `<!--]-->` というコメントノードで囲まれてレンダリングされます．

```ts
function hydrateFragment(
  node: Node,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): Node | null {
  // 開始コメント（<!--[-->）を el に設定
  vnode.el = node;

  // 開始コメントの次から子要素が始まる
  let current = nextSibling(node);
  const children = vnode.children as VNode[];

  if (children && children.length > 0) {
    current = hydrateChildren(current, children, parentComponent);
  }

  // 終了コメント（<!--]-->）を anchor に設定
  vnode.anchor = current;
  return current ? nextSibling(current) : null;
}
```

```html
<!-- SSR 出力例 -->
<!--[-->
<p>Item 1</p>
<p>Item 2</p>
<p>Item 3</p>
<!--]-->
```

## createSSRApp の実装

`createSSRApp` は通常の `createApp` とほぼ同じですが，mount 時に Hydration を行います．

```ts
// runtime-dom/index.ts

// Hydration レンダラーを作成
const { hydrate: hydrateVNode } = createHydrationRenderer({
  patchProp,
  nextSibling: nodeOps.nextSibling,
});

export const createSSRApp = ((...args) => {
  const app = _createApp(...args);
  const { mount } = app;

  app.mount = (selector: string) => {
    const container = document.querySelector(selector);
    if (!container) return;

    // コンテナに SSR コンテンツがあるかチェック
    if (container.hasChildNodes()) {
      // Hydration を実行
      const proxy = mount(container, true /* isHydrate */);
      return proxy;
    } else {
      // SSR コンテンツがなければ通常のマウント
      mount(container);
    }
  };

  return app;
}) as CreateAppFunction<Element>;
```

## 処理フロー

```
[サーバー側]
renderToString(app)
  ↓
<div id="app">
  <button>Count: 0</button>
</div>

[クライアント側]
createSSRApp(App).mount('#app')
  ↓
container.hasChildNodes() → true
  ↓
hydrate(vnode, container)
  ↓
hydrateNode(button, vnode)
  ├── vnode.el = button  ← VNode と DOM を関連付け
  └── patchProp(button, 'onClick', null, handler)  ← イベントをアタッチ
  ↓
ボタンをクリックするとリアクティビティが動作
```

## 使用例

### サーバーサイド

```ts
// server.ts
import { createApp } from '@chibivue/runtime-dom'
import { renderToString } from '@chibivue/server-renderer'
import App from './App.vue'

const app = createApp(App)
const html = await renderToString(app)

// HTML をクライアントに送信
res.send(`
  <!DOCTYPE html>
  <html>
    <body>
      <div id="app">${html}</div>
      <script src="/client.js"></script>
    </body>
  </html>
`)
```

### クライアントサイド

```ts
// client.ts
import { createSSRApp } from '@chibivue/runtime-dom'
import App from './App.vue'

// createSSRApp を使用（createApp ではなく）
const app = createSSRApp(App)
app.mount('#app')
```

### App コンポーネント

```vue
<!-- App.vue -->
<script setup>
import { ref } from '@chibivue/runtime-core'

const count = ref(0)
const increment = () => count.value++
</script>

<template>
  <button @click="increment">Count: {{ count }}</button>
</template>
```

## Hydration ミスマッチ

Hydration では，SSR で生成された HTML と，クライアントで生成される VNode が一致している必要があります．一致しない場合，「Hydration ミスマッチ」が発生します．

### よくある原因

1. **日時・乱数**: `new Date()` や `Math.random()` はサーバーとクライアントで異なる値になる
2. **ブラウザ固有の API**: `window` や `localStorage` はサーバーでは存在しない
3. **条件分岐**: サーバーとクライアントで異なるパスを通る

### 対策

```vue
<script setup>
import { ref, onMounted } from '@chibivue/runtime-core'

// サーバーとクライアントで同じ初期値
const clientOnly = ref(false)

// クライアント側でのみ更新
onMounted(() => {
  clientOnly.value = true
})
</script>

<template>
  <div v-if="clientOnly">
    This content is only shown on client
  </div>
</template>
```

<KawaikoNote variant="warning" title="ミスマッチに注意！">

Hydration ミスマッチが発生すると，Vue は警告を出し，最悪の場合は DOM が壊れます．
サーバーとクライアントで同じ出力になるよう注意しましょう．

</KawaikoNote>

## 今後の拡張

現在の実装は最小限ですが，Vue 本家には以下のような機能があります：

1. **Hydration ミスマッチの検出**: 開発モードでサーバー/クライアントの不一致を検出
2. **Partial Hydration**: 必要な部分だけを Hydration（パフォーマンス最適化）
3. **PatchFlags を使った最適化**: 静的なノードは Hydration をスキップ
4. **非同期コンポーネントの Hydration**: `Suspense` との連携

<KawaikoNote variant="surprise" title="Hydration 完了！">

これで SSR の最後のピースが揃いました．
`renderToString` でサーバーサイドレンダリングし，
`createSSRApp` で Hydration することで，
完全な SSR アプリケーションを実現できます．

</KawaikoNote>

## まとめ

Hydration の実装は以下の要素で構成されています：

1. **createHydrationRenderer**: Hydration 用のレンダラーを作成
2. **hydrateNode**: VNode の種類に応じた処理の分岐
3. **hydrateElement**: HTML 要素とイベントハンドラーのアタッチ
4. **hydrateChildren**: 子要素の再帰的な処理
5. **hydrateFragment**: Fragment（コメントノードで囲まれた領域）の処理
6. **createSSRApp**: Hydration 対応のアプリケーションファクトリ

Hydration の本質は「既存の DOM を作り直さずに VNode と関連付ける」ことです．これにより，SSR の高速な初期表示と，SPA のリッチなインタラクティビティを両立できます．
