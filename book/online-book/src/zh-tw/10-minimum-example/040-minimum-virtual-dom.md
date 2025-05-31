# 最小虛擬 DOM

## 虛擬 DOM 用於什麼？

通過在上一章中引入響應式系統，我們能夠動態更新螢幕．讓我們再次查看當前渲染函數的內容．

```ts
const render: RootRenderFunction = (vnode, container) => {
  while (container.firstChild) container.removeChild(container.firstChild)
  const el = renderVNode(vnode)
  hostInsert(el, container)
}
```

有些人可能在上一章中注意到這個函數中有很多浪費．

看看遊樂場．

```ts
const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => state.count++

    return function render() {
      return h('div', { id: 'my-app' }, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, ['increment']),
      ])
    }
  },
})
```

問題是當執行 increment 時，只有 `count: ${state.count}` 部分發生變化，但在 renderVNode 中，所有 DOM 元素都被刪除並從頭重新創建．這感覺非常浪費．\
雖然現在看起來工作正常，因為它仍然很小，但您可以很容易地想像，如果您在開發 Web 應用程式時每次都必須從頭重新創建複雜的 DOM，性能將大大降低．\
因此，由於我們已經有了虛擬 DOM，我們希望實現一個比較當前虛擬 DOM 與之前虛擬 DOM 的實現，並僅使用 DOM 操作更新存在差異的部分．\
現在，這是本章的主要主題．

讓我們看看我們想在源代碼中做什麼．當我們有像上面這樣的組件時，渲染函數的返回值變成如下的虛擬 DOM．在初始渲染時，計數為 0，所以它看起來像這樣：

```ts
const vnode = {
  type: "div",
  props: { id: "my-app" },
  children: [
    {
      type: "p",
      props: {},
      children: [`count: 0`]
    },
    {
      type: "button",
      { onClick: increment },
      ["increment"]
    }
  ]
}
```

讓我們保留這個 vnode 並為下一次渲染準備另一個 vnode．以下是第一次點擊按鈕時的 vnode：

```ts
const nextVnode = {
  type: "div",
  props: { id: "my-app" },
  children: [
    {
      type: "p",
      props: {},
      children: [`count: 1`] // 只想更新這部分
    },
    {
      type: "button",
      { onClick: increment },
      ["increment"]
    }
  ]
}
```

現在，有了這兩個 vnodes，螢幕處於 vnode 的狀態（在它變成 nextVnode 之前）．\
我們希望將這兩個傳遞給一個名為 patch 的函數，並僅渲染差異．

```ts
const vnode = {...}
const nextVnode = {...}
patch(vnode, nextVnode, container)
```

我之前介紹了函數名，但這種差異渲染稱為「patch」．\
有時也稱為「reconciliation」．通過使用這兩個虛擬 DOM，您可以高效地更新螢幕．

## 在實現 patch 函數之前

這與主要主題沒有直接關係，但讓我們在這裡做一個輕微的重構（因為這對我們接下來要討論的內容很方便）．\
讓我們在 vnode.ts 中創建一個名為 createVNode 的函數，並讓 h 函數調用它．

```ts
export function createVNode(
  type: VNodeTypes,
  props: VNodeProps | null,
  children: unknown,
): VNode {
  const vnode: VNode = { type, props, children: [] }
  return vnode
}
```

也更改 h 函數．

```ts
export function h(
  type: string,
  props: VNodeProps,
  children: (VNode | string)[],
) {
  return createVNode(type, props, children)
}
```

現在，讓我們進入正題．到目前為止，VNode 擁有的小元素的類型一直是 `(Vnode | string)[]`，但僅將 Text 視為字串是不夠的，所以讓我們嘗試將其統一為 VNode．\
Text 不僅僅是一個字串，它作為 HTML TextElement 存在，所以它包含的資訊比僅僅一個字串更多．\
我們希望將其視為 VNode 以便處理周圍的資訊．\
具體來說，讓我們使用符號 Text 將其作為 VNode 的類型．\
例如，當有像 `"hello"` 這樣的文本時，

```ts
{
  type: Text,
  props: null,
  children: "hello"
}
```

是表示形式．

另外，這裡需要注意的一點是，當執行 h 函數時，我們將繼續使用傳統的表達式，我們將通過在渲染函數中應用名為 normalize 的函數來轉換它，以表示如上所述的 Text．這樣做是為了匹配原始的 Vue.js．

`~/packages/runtime-core/vnode.ts`;

```ts
export const Text = Symbol();

export type VNodeTypes = string | typeof Text;

export interface VNode<HostNode = any> {
  type: VNodeTypes;
  props: VNodeProps | null;
  children: VNodeNormalizedChildren;
}

export interface VNodeProps {
  [key: string]: any;
}

// 規範化後的類型
export type VNodeNormalizedChildren = string | VNodeArrayChildren;
export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>;

export type VNodeChild = VNodeChildAtom | VNodeArrayChildren;
type VNodeChildAtom = VNode | string;

export function createVNode(..){..} // 省略

// 實現 normalize 函數（在 renderer.ts 中使用）
export function normalizeVNode(child: VNodeChild): VNode {
  if (typeof child === "object") {
    return { ...child } as VNode;
  } else {
    // 將字串轉換為前面介紹的所需形式
    return createVNode(Text, null, String(child));
  }
}
```

現在 Text 可以被視為 VNode．

## patch 函數的設計

首先，讓我們看看代碼庫中 patch 函數的設計．\
（我們不需要在這裡實現它，只需理解它．）\
patch 函數比較兩個 vnodes，vnode1 和 vnode2．但是，vnode1 最初不存在．\
因此，patch 函數分為兩個過程：「初始（從 vnode2 生成 dom）」和「更新 vnode1 和 vnode2 之間的差異」．\
這些過程分別命名為「mount」和「patch」．\
它們分別對 ElementNode 和 TextNode 執行（結合為「process」，每個都有「mount」和「patch」名稱）．

![patch_fn_architecture](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/patch_fn_architecture.drawio.png)

```ts
const patch = (
  n1: VNode | string | null,
  n2: VNode | string,
  container: HostElement,
) => {
  const { type } = n2
  if (type === Text) {
    processText(n1, n2, container)
  } else {
    processElement(n1, n2, container)
  }
}

const processElement = (
  n1: VNode | null,
  n2: VNode,
  container: HostElement,
) => {
  if (n1 === null) {
    mountElement(n2, container)
  } else {
    patchElement(n1, n2)
  }
}

const processText = (n1: string | null, n2: string, container: HostElement) => {
  if (n1 === null) {
    mountText(n2, container)
  } else {
    patchText(n1, n2)
  }
}
```

## 實際實現

現在讓我們實際實現虛擬 DOM 的 patch 函數．\
首先，我們希望在 vnode 掛載時在 vnode 中有對實際 DOM 的引用，無論它是 Element 還是 Text．\
所以我們向 vnode 添加「el」屬性．

`~/packages/runtime-core/vnode.ts`

```ts
export interface VNode<HostNode = RendererNode> {
  type: VNodeTypes
  props: VNodeProps | null
  children: VNodeNormalizedChildren
  el: HostNode | undefined // [!code ++]
}
```

現在讓我們轉到 `~/packages/runtime-core/renderer.ts`．\
我們將在 `createRenderer` 函數內部實現它並刪除 `renderVNode` 函數．

```ts
export function createRenderer(options: RendererOptions) {
  // .
  // .
  // .

  const patch = (n1: VNode | null, n2: VNode, container: RendererElement) => {
    const { type } = n2
    if (type === Text) {
      // processText(n1, n2, container);
    } else {
      // processElement(n1, n2, container);
    }
  }
}
```

讓我們從 `processElement` 和 `mountElement` 開始實現．

```ts
const processElement = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
) => {
  if (n1 === null) {
    mountElement(n2, container)
  } else {
    // patchElement(n1, n2);
  }
}

const mountElement = (vnode: VNode, container: RendererElement) => {
  let el: RendererElement
  const { type, props } = vnode
  el = vnode.el = hostCreateElement(type as string)

  mountChildren(vnode.children, el) // TODO:

  if (props) {
    for (const key in props) {
      hostPatchProp(el, key, props[key])
    }
  }

  hostInsert(el, container)
}
```

由於它是一個元素，我們還需要掛載其子元素．\
讓我們使用我們之前創建的 `normalize` 函數．

```ts
const mountChildren = (children: VNode[], container: RendererElement) => {
  for (let i = 0; i < children.length; i++) {
    const child = (children[i] = normalizeVNode(children[i]))
    patch(null, child, container)
  }
}
```

這樣，我們已經實現了元素的掛載．\
接下來，讓我們轉到掛載 Text．\
但是，這只是一個簡單的 DOM 操作．\
在設計說明中，我們將其分為 `mountText` 和 `patchText` 函數，但由於處理不多，並且預計將來不會變得更複雜，讓我們直接編寫它．

```ts
const processText = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
) => {
  if (n1 == null) {
    hostInsert((n2.el = hostCreateText(n2.children as string)), container)
  } else {
    // TODO: patch
  }
}
```

現在，隨著初始渲染的掛載完成，讓我們將一些處理從 `createAppAPI` 中的 `mount` 函數移動到 `render` 函數，以便我們可以保存兩個 vnodes．\
具體來說，我們將 `rootComponent` 傳遞給 `render` 函數並在其中執行 ReactiveEffect 註冊．

```ts
return function createApp(rootComponent) {
  const app: App = {
    mount(rootContainer: HostElement) {
      // 只傳遞 rootComponent
      render(rootComponent, rootContainer)
    },
  }
}
```

```ts
const render: RootRenderFunction = (rootComponent, container) => {
  const componentRender = rootComponent.setup!()

  let n1: VNode | null = null

  const updateComponent = () => {
    const n2 = componentRender()
    patch(n1, n2, container)
    n1 = n2
  }

  const effect = new ReactiveEffect(updateComponent)
  effect.run()
}
```

現在，讓我們嘗試在遊樂場中渲染，看看它是否工作！

由於我們還沒有實現 patch 函數，螢幕不會更新．

所以，讓我們繼續編寫 patch 函數．

```ts
const patchElement = (n1: VNode, n2: VNode) => {
  const el = (n2.el = n1.el!)

  const props = n2.props

  patchChildren(n1, n2, el)

  for (const key in props) {
    if (props[key] !== n1.props?.[key]) {
      hostPatchProp(el, key, props[key])
    }
  }
}

const patchChildren = (n1: VNode, n2: VNode, container: RendererElement) => {
  const c1 = n1.children as VNode[]
  const c2 = n2.children as VNode[]

  for (let i = 0; i < c2.length; i++) {
    const child = (c2[i] = normalizeVNode(c2[i]))
    patch(c1[i], child, container)
  }
}
```

Text 節點也是如此．

```ts
const processText = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
) => {
  if (n1 == null) {
    hostInsert((n2.el = hostCreateText(n2.children as string)), container)
  } else {
    // 添加 patch 邏輯
    const el = (n2.el = n1.el!)
    if (n2.children !== n1.children) {
      hostSetText(el, n2.children as string)
    }
  }
}
```

※ 關於 patchChildren，通常我們需要通過添加 key 屬性來處理動態長度的子元素，但由於我們正在實現一個小的虛擬 DOM，我們不會在這裡涵蓋其實用性．\
如果您感興趣，請參考基礎虛擬 DOM 部分．\
在這裡，我們的目標是在一定程度上理解虛擬 DOM 的實現和作用．

現在我們可以執行差異渲染，讓我們看看遊樂場．

![patch_rendering](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/patch_rendering.png)

我們已經成功使用虛擬 DOM 實現了補丁！！！！！恭喜！

到此為止的源代碼：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/040_vdom_system)
