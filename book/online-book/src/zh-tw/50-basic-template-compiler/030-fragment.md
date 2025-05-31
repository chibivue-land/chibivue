# 實現 Fragment

## 當前實現的問題

讓我們嘗試在遊樂場中執行以下程式碼：

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

你可能會遇到這樣的錯誤：

![fragment_error.png](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/fragment_error.png)

查看錯誤訊息，似乎與 Function 建構函式有關．

換句話說，程式碼生成似乎在某種程度上是成功的，所以讓我們看看實際生成了什麼程式碼．

```ts
return function render(_ctx) {
  with (_ctx) {
    const { createVNode: _createVNode } = ChibiVue

    return _createVNode("header", null, "header")"\n  "_createVNode("main", null, "main")"\n  "_createVNode("footer", null, "footer")
   }
}
```

`return` 語句後的程式碼是不正確的．當前的程式碼生成實現不處理根是陣列（即不是單個節點）的情況．

我們將修復這個問題．

## 應該生成什麼程式碼？

即使我們正在進行修改，應該生成什麼樣的程式碼？

總之，程式碼應該看起來像這樣：

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

這個 `Fragment` 是在 Vue 中定義的符號．

換句話說，Fragment 不像 FragmentNode 那樣表示為 AST，而是簡單地作為 ElementNode 的標籤．

我們將在渲染器中實現 Fragment 的處理，類似於 Text．

## 實現

Fragment 符號將在 runtime-core/vnode.ts 中實現．

讓我們將其作為 VNodeTypes 中的新類型添加．

```ts
export type VNodeTypes = Component | typeof Text | typeof Fragment | string

export const Fragment = Symbol()
```

實現渲染器．

在 patch 函式中為 fragment 添加分支．

```ts
if (type === Text) {
  processText(n1, n2, container, anchor)
} else if (shapeFlag & ShapeFlags.ELEMENT) {
  processElement(n1, n2, container, anchor, parentComponent)
} else if (type === Fragment) {
  // 這裡
  processFragment(n1, n2, container, anchor, parentComponent)
} else if (shapeFlag & ShapeFlags.COMPONENT) {
  processComponent(n1, n2, container, anchor, parentComponent)
} else {
  // do nothing
}
```

注意插入或刪除元素通常應該用 anchor 作為標記來實現．

顧名思義，anchor 表示 fragment 的開始和結束位置．

起始元素由 VNode 中現有的 `el` 屬性表示，但目前沒有表示結束的屬性．讓我們添加它．

```ts
export interface VNode<HostNode = any> {
  // .
  // .
  // .
  anchor: HostNode | null // fragment anchor // 添加
  // .
  // .
}
```

在掛載期間設置 anchor．

在 mount/patch 中將 fragment 的結束作為 anchor 傳遞．

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

當 fragment 的元素在更新期間發生變化時要小心．

```ts
const move = (
  vnode: VNode,
  container: RendererElement,
  anchor: RendererElement | null,
) => {
  const { type, children, el, shapeFlag } = vnode

  // .

  if (type === Fragment) {
    hostInsert(el!, container, anchor)
    for (let i = 0; i < (children as VNode[]).length; i++) {
      move((children as VNode[])[i], container, anchor)
    }
    hostInsert(vnode.anchor!, container, anchor) // 插入 anchor
    return
  }
  // .
  // .
  // .
}
```

在卸載期間，也依賴 anchor 來刪除元素．

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
    next = hostNextSibling(cur)! // ※ 將此添加到 nodeOps！
    hostRemove(cur)
    cur = next
  }
  hostRemove(end)
}
```

## 測試

我們之前編寫的程式碼應該正確工作．

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

目前，我們不能使用像 v-for 這樣的指令，所以我們不能編寫在模板中使用 fragment 並改變元素數量的描述．

讓我們透過編寫編譯後的程式碼來模擬行為，看看它是如何工作的．

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

看起來工作正常！

到此為止的原始碼：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/030_fragment)
