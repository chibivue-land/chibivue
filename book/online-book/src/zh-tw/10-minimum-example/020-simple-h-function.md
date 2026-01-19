# 讓我們啟用 HTML 元素的渲染

## 什麼是 h 函數？

到目前為止，我們已經讓以下源代碼工作：

```ts
import { createApp } from 'vue'

const app = createApp({
  render() {
    return 'Hello world.'
  },
})

app.mount('#app')
```

這是一個簡單地在螢幕上渲染「Hello World.」的函數．  
由於只有一條消息有點孤單，讓我們考慮一個也可以渲染 HTML 元素的開發者介面．  
這就是 `h 函數` 的用武之地．這個 `h` 代表 `hyperscript`，作為在 JavaScript 中編寫 HTML（超文本標記語言）的函數提供．

> h() 是 hyperscript 的縮寫 - 意思是「產生 HTML（超文本標記語言）的 JavaScript」。這個名稱繼承自許多虛擬 DOM 實現共享的約定。一個更具描述性的名稱可能是 createVnode()，但當您必須在渲染函數中多次調用此函數時，較短的名稱會有所幫助。

引用：https://vuejs.org/guide/extras/render-function.html#creating-vnodes

讓我們看看 Vue.js 中的 h 函數．

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

作為 h 函數的基本用法，您將標籤名稱指定為第一個參數，將屬性指定為第二個參數，將子元素陣列指定為第三個參數．  
在這裡，我特別提到了「基本用法」，因為 h 函數實際上對其參數有多種語法，您可以省略第二個參數或不對子元素使用陣列．  
但是，在這裡我們將以最基本的語法實現它．

## 我們應該如何實現它？

現在我們了解了開發者介面，讓我們決定如何實現它．  
需要注意的重要一點是它如何用作渲染函數的返回值．  
這意味著 `h` 函數返回某種對象並在內部使用該結果．\
由於複雜的子元素很難理解，讓我們考慮實現簡單 h 函數的結果．

```ts
const result = h('div', { class: 'container' }, ['hello'])
```

`result` 中應該存儲什麼樣的結果？（我們應該如何格式化結果以及如何渲染它？）

讓我們假設以下對象存儲在 `result` 中：

```ts
const result = {
  type: 'div',
  props: { class: 'container' },
  children: ['hello'],
}
```

換句話說，我們將從渲染函數接收類似於上面的對象，並使用它來執行 DOM 操作並渲染它．\
圖像是這樣的（在 `createApp` 的 `mount` 內部）：

```ts
const app: App = {
  mount(rootContainer: HostElement) {
    const node = rootComponent.render!()
    render(node, rootContainer)
  },
}
```

嗯，唯一改變的是我們將 `message` 字串更改為 `node` 對象．  
我們現在要做的就是在渲染函數中基於對象執行 DOM 操作．

實際上，這個對象有一個名字，「虛擬 DOM」．  
我們將在虛擬 DOM 章節中更多地解釋虛擬 DOM，所以現在只需記住這個名字．\

## 實現 h 函數

首先，創建必要的文件．

```sh
pwd # ~
touch packages/runtime-core/vnode.ts
touch packages/runtime-core/h.ts
```

在 vnode.ts 中定義類型．這就是我們在 vnode.ts 中要做的全部．

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

接下來，在 h.ts 中實現函數體．

```ts
export function h(
  type: string,
  props: VNodeProps,
  children: (VNode | string)[],
) {
  return { type, props, children }
}
```

現在，讓我們嘗試在遊樂場中使用 h 函數．

```ts
import { createApp, h } from 'chibivue'

const app = createApp({
  render() {
    return h('div', {}, ['Hello world.'])
  },
})

app.mount('#app')
```

螢幕上的顯示被破壞了，但如果您在 apiCreateApp 中添加日誌，您可以看到它按預期工作．

```ts
mount(rootContainer: HostElement) {
  const vnode = rootComponent.render!();
  console.log(vnode); // 檢查日誌
  render(vnode, rootContainer);
},
```

現在，讓我們實現渲染函數．\
在 RendererOptions 中實現 `createElement`，`createText` 和 `insert`．

```ts
export interface RendererOptions<HostNode = RendererNode> {
  createElement(type: string): HostNode // 添加

  createText(text: string): HostNode // 添加

  setElementText(node: HostNode, text: string): void

  insert(child: HostNode, parent: HostNode, anchor?: HostNode | null): void // 添加
}
```

在渲染函數中實現 `renderVNode` 函數．現在，我們忽略 `props`．

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

在 runtime-dom 的 nodeOps 中，定義實際的 DOM 操作．

```ts
export const nodeOps: RendererOptions<Node> = {
  // 添加
  createElement: tagName => {
    return document.createElement(tagName)
  },

  // 添加
  createText: (text: string) => {
    return document.createTextNode(text)
  },

  setElementText(node, text) {
    node.textContent = text
  },

  // 添加
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null)
  },
}
```

嗯，此時，您應該能夠在螢幕上渲染元素．\
嘗試在遊樂場中編寫和測試各種東西！

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

耶！現在我們可以使用 h 函數來渲染各種標籤！

![](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/simple_h_function.png)

到此為止的源代碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/020_simple_h_function)
