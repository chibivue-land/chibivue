# HTML要素をレンダリングできるようにしよう

## h function とは

<KawaikoNote variant="question" title="h って何の略？">

`h` は `hyperscript` の略です．HTML (Hyper Text Markup Language) を
JavaScript で表現するための関数なので，この名前がついています！

</KawaikoNote>

ここまでで，以下のようなソースコードが動作するようになりました．

```ts
import { createApp } from 'vue'

const app = createApp({
  render() {
    return 'Hello world.'
  },
})

app.mount('#app')
```

これはシンプルな `Hello World.` と画面に描画するための関数でした．  
メッセージだけでは何とも寂しいので，HTML 要素も描画できるような開発者インタフェースを考えてみましょう．  
そこで登場するのが `h function` です．この `h` というのは `hyperscript` の略で，HTML (Hyper Text Markup Language)を JS で記述する関数として提供されます．

> h() is short for hyperscript - which means "JavaScript that produces HTML (hypertext markup language)". This name is inherited from conventions shared by many Virtual DOM implementations. A more descriptive name could be createVnode(), but a shorter name helps when you have to call this function many times in a render function.

引用: https://vuejs.org/guide/extras/render-function.html#creating-vnodes

Vue.js の h function についてみてみましょう．

```ts
import { createApp, h } from 'vue'

const app = createApp({
  render() {
    return h('div', {}, [
      h('p', {}, ['HelloWorld']),
      h('button', {}, ['click me!']),
    ])
  },
})

app.mount('#app')
```

h function の基本的な使い方として，第 1 引数にタグ名，第 2 引数に属性，第 3 引数に子要素を配列で記述します．  
ここで，「基本的な使い方」とわざわざ言ったのは，実は h function は引数について記法が複数あり，第 2 引数を省略したり，子要素は配列にしなかったりという使い方もできます．  
ですが，ここでは最も基本的な記法に統一して実装してみようかと思います．

## どうやって実装しよう

開発者インタフェースについてはよくわかったので，どのような実装にするか方針を決めましょう．  
注目するべき点は，render 関数の戻り値として扱っているところです．  
これはつまり，h 関数というものが何かしらのオブジェクトを返して内部でその結果を利用しているということです．
複雑な子要素を含むとわかりづらいので，以下のシンプルな h 関数を実装した結果について考えてみましょう．

```ts
const result = h('div', { class: 'container' }, ['hello'])
```

result にはどのような結果を格納するのが良いでしょうか？\
(結果をどのような形にして，どうレンダリングしましょうか？)

result には以下のようなオブジェクトが格納されることにしてみましょう．

```ts
const result = {
  type: 'div',
  props: { class: 'container' },
  children: ['hello'],
}
```

つまり，render 関数から上記のようなオブジェクトをもらい，それを元に DOM 操作をしてレンダリングをすればいいのです．\
イメージ的には以下です．(createApp の mount の中です．)

```ts
const app: App = {
  mount(rootContainer: HostElement) {
    const node = rootComponent.render!()
    render(node, rootContainer)
  },
}
```

変わったところというと，message という文字列ではなく node というオブジェクトに変えただけです．  
あとは render 関数でオブジェクトを元に DOM 操作をすれば OK です．

実は，このオブジェクトには名前がついていて，「仮想 DOM」と言います．
仮想 DOM については仮想 DOM のチャプターで詳しく解説するので，とりあえず名前だけ覚えてもらえれば大丈夫です．

<KawaikoNote variant="funny" title="仮想 DOM の正体">

「仮想 DOM」と聞くと難しそうですが，中身はただの JavaScript オブジェクト！
`{ type, props, children }` という構造で DOM を表現しているだけです．

</KawaikoNote>

## h function を実装する

まずは必要なファイルを作成します．

```sh
pwd # ~
touch packages/runtime-core/vnode.ts
touch packages/runtime-core/h.ts
```

vnode.ts に型を定義します．今回 vnode.ts でやるのはこれだけです．

```ts
export interface VNode {
  type: string
  props: VNodeProps
  children: (VNode | string)[]
}

export interface VNodeProps {
  [key: string]: any
}
```

続いて h.ts で関数本体を実装します．

```ts
export function h(
  type: string,
  props: VNodeProps,
  children: (VNode | string)[],
) {
  return { type, props, children }
}
```

とりあえずここまでで playground にて h 関数を使ってみましょう．

```ts
import { createApp, h } from 'chibivue'

const app = createApp({
  render() {
    return h('div', {}, ['Hello world.'])
  },
})

app.mount('#app')
```

画面の表示は壊れてしまっていますが，apiCreateApp でログを仕込んでみると期待通りになっていることが確認できます．

```ts
mount(rootContainer: HostElement) {
  const vnode = rootComponent.render!();
  console.log(vnode); // ログを見てみる
  render(vnode, rootContainer);
},
```

それでは，render 関数を実装してみましょう．
RendererOptions に `createElement` と `createText` と `insert` を実装します．

```ts
export interface RendererOptions<HostNode = RendererNode> {
  createElement(type: string): HostNode // 追加

  createText(text: string): HostNode // 追加

  setElementText(node: HostNode, text: string): void

  insert(child: HostNode, parent: HostNode, anchor?: HostNode | null): void // 追加
}
```

render 関数に `renderVNode` という関数を実装してみます．\
(とりあえず一旦 props は無視して実装しています．)

```ts
export function createRenderer(options: RendererOptions) {
  const {
    createElement: hostCreateElement,
    createText: hostCreateText,
    insert: hostInsert,
  } = options

  function renderVNode(vnode: VNode | string) {
    if (typeof vnode === 'string') return hostCreateText(vnode)
    const el = hostCreateElement(vnode.type)

    for (const child of vnode.children) {
      const childEl = renderVNode(child)
      hostInsert(childEl, el)
    }

    return el
  }

  const render: RootRenderFunction = (vnode, container) => {
    const el = renderVNode(vnode)
    hostInsert(el, container)
  }

  return { render }
}
```

runtime-dom の nodeOps の方でも実際の DOM のオペレーションを定義してあげます．

```ts
export const nodeOps: RendererOptions<Node> = {
  // 追加
  createElement: tagName => {
    return document.createElement(tagName)
  },

  // 追加
  createText: (text: string) => {
    return document.createTextNode(text)
  },

  setElementText(node, text) {
    node.textContent = text
  },

  // 追加
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null)
  },
}
```

さて，ここまでで画面に要素を描画できるようになっているはずです．\
playground で色々書いてみて試してみましょう!

```ts
import { createApp, h } from 'chibivue'

const app = createApp({
  render() {
    return h('div', {}, [
      h('p', {}, ['Hello world.']),
      h('button', {}, ['click me!']),
    ])
  },
})

app.mount('#app')
```

やった！ h 関数でいろんなタグを描画できるようになった！

![](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/simple_h_function.png)

<KawaikoNote variant="surprise" title="h 関数完成！">

これで HTML を JavaScript で表現できるようになりました！
入れ子構造でどんな複雑な画面も作れます．

</KawaikoNote>

ここまでのソースコード:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/020_simple_h_function)
