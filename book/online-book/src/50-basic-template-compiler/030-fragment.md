# Fragment を実装する

## 今の実装の問題点

以下のようなコードを playground で実行してみましょう。

```ts
import { createApp, defineComponent } from 'chibivue'

const App = defineComponent({
  template: `<header>header</header>
<main>main</main>
<footer>footer</footer>`,
})

const app = createApp(App)

app.mount('#app')
```

以下のようなエラーが出てしまうかと思います。

![fragment_error.png](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/fragment_error.png)

エラー文をみてみると、 Function コンストラクタで起きているようです。

つまり、codegen までは一応成功しているようなので、実際にどのようなコードが生成されたのかみてみましょう。

```ts
return function render(_ctx) {
  with (_ctx) {
    const { createVNode: _createVNode } = ChibiVue

    return _createVNode("header", null, "header")"\n  "_createVNode("main", null, "main")"\n  "_createVNode("footer", null, "footer")
   }
}
```

return の先がおかしなことになってしまっていますね。今の codegen の実装だと、ルートが配列だった場合(単一のノードではない場合)を考慮できていません。  
今回はこれを修正していきます。

## どういうコードを生成すればいいのか

修正していくとはいえ、どういうコードを生成できるようになれば良いでしょうか。

結論から言うと以下のようなコードになります。

```ts
return function render(_ctx) {
  with (_ctx) {
    const { createVNode: _createVNode, Fragment: _Fragment } = ChibiVue

    return _createVNode(_Fragment, null, [
      [
        _createVNode('header', null, 'header'),
        '\n  ',
        _createVNode('main', null, 'main'),
        '\n  ',
        _createVNode('footer', null, 'footer'),
      ],
    ])
  }
}
```

この `Fragment` というものは Vue で定義されている symbol です。  
つまり、Fragment は FragmentNode のような AST として表現されるものではなく、単に ElementNode の tag として表現されます。

そして、tag が Fragment あった場合の処理を renderer に実装します。  
Text と似たよう感じです。

## 実装していく

fragment の symbol は runtime-core/vnode.ts の方に実装されます。

VNodeTypes の新たな種類として追加しましょう。

```ts
export type VNodeTypes =
  | Component; // `object` になってると思うので、ついでに直しておきました
  | typeof Text
  | typeof Fragment  // これを追加
  | string

export const Fragment = Symbol(); // これを追加
```

renderer を実装します。

patch 関数に fragment の時の分岐を追加します。

```ts
if (type === Text) {
  processText(n1, n2, container, anchor)
} else if (shapeFlag & ShapeFlags.ELEMENT) {
  processElement(n1, n2, container, anchor, parentComponent)
} else if (type === Fragment) {
  // ここ
  processFragment(n1, n2, container, anchor, parentComponent)
} else if (shapeFlag & ShapeFlags.COMPONENT) {
  processComponent(n1, n2, container, anchor, parentComponent)
} else {
  // do nothing
}
```

注意点としては、要素の insert や remove は基本的に anchor を目印に実装して行く必要があることです。

anchor というのは名の通り、フラグメントの開始と終了の位置を示すものです。

始端の要素 は 従来から VNode に存在する `el` というプロパティが担いますが、現時点だと終端を表すプロパティが存在しないので追加します。

```ts
export interface VNode<HostNode = any> {
  // .
  // .
  // .
  anchor: HostNode | null // fragment anchor // 追加
  // .
  // .
}
```

mount 時に anchor を設定します

そして、mount / patch に anchor として フラグメントの終端を渡してあげます。

```ts
const processFragment = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
) => {
  const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(''))!
  const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(''))!

  if (n1 == null) {
    hostInsert(fragmentStartAnchor, container, anchor)
    hostInsert(fragmentEndAnchor, container, anchor)
    mountChildren(
      n2.children as VNode[],
      container,
      fragmentEndAnchor,
      parentComponent,
    )
  } else {
    patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent)
  }
}
```

更新時、fragment の要素が変動する際も注意します。

```ts
const move = (
  vnode: VNode,
  container: RendererElement,
  anchor: RendererElement | null,
) => {
  const { type, children, el, shapeFlag } = vnode

  // .
  // .

  if (type === Fragment) {
    hostInsert(el!, container, anchor)
    for (let i = 0; i < (children as VNode[]).length; i++) {
      move((children as VNode[])[i], container, anchor)
    }
    hostInsert(vnode.anchor!, container, anchor) // アンカーを挿入
    return
  }
  // .
  // .
  // .
}
```

unmount 時も anchor を頼りに要素を削除していきます。

```ts
const remove = (vnode: VNode) => {
  const { el, type, anchor } = vnode
  if (type === Fragment) {
    removeFragment(el!, anchor!)
  }

  // .
  // .
  // .
}

const removeFragment = (cur: RendererNode, end: RendererNode) => {
  let next
  while (cur !== end) {
    next = hostNextSibling(cur)! // ※ nodeOps に追加しましょう！
    hostRemove(cur)
    cur = next
  }
  hostRemove(end)
}
```

## 動作を見てみる

先ほどのコードはきちんと動くようになっているはずです。

```ts
import { Fragment, createApp, defineComponent, h, ref } from 'chibivue'

const App = defineComponent({
  template: `<header>header</header>
<main>main</main>
<footer>footer</footer>`,
})

const app = createApp(App)

app.mount('#app')
```

現状だと、v-for ディレクティブなどが使えないことから、template で fragment を使いつつ要素の個数を変化させるような記述ができないので、

擬似的に コンパイル後のコードを書いて動作を見てみましょう。

```ts
import { Fragment, createApp, defineComponent, h, ref } from 'chibivue'

// const App = defineComponent({
//   template: `<header>header</header>
//   <main>main</main>
//   <footer>footer</footer>`,
// });

const App = defineComponent({
  setup() {
    const list = ref([0])
    const update = () => {
      list.value = [...list.value, list.value.length]
    }
    return () =>
      h(Fragment, {}, [
        h('button', { onClick: update }, 'update'),
        ...list.value.map(i => h('div', {}, i)),
      ])
  },
})

const app = createApp(App)

app.mount('#app')
```

ちゃんと動作しているようです！

ここまでのソースコード: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/030_fragment)
