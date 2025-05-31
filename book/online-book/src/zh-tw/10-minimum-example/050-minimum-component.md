# 我想使用基於組件的方法進行開發

## 基於整理現有實現的思考

到目前為止，我們已經小規模地實現了 createApp API、響應式系統和虛擬 DOM 系統。\
通過當前的實現，我們可以使用響應式系統動態更改 UI，並使用虛擬 DOM 系統執行高效渲染。\
然而，作為開發者介面，所有內容都寫在 createAppAPI 中。\
實際上，我想更多地分割檔案並實現通用組件以實現可重用性。\
首先，讓我們回顧一下現有實現中當前混亂的部分。請查看 renderer.ts 中的 render 函式。

```ts
const render: RootRenderFunction = (rootComponent, container) => {
  const componentRender = rootComponent.setup!()

  let n1: VNode | null = null
  let n2: VNode = null!

  const updateComponent = () => {
    const n2 = componentRender()
    patch(n1, n2, container)
    n1 = n2
  }

  const effect = new ReactiveEffect(updateComponent)
  effect.run()
}
```

在 render 函式中，直接定義了關於根組件的資訊。\
實際上，n1、n2、updateComponent 和 effect 對每個組件都存在。\
事實上，從現在開始，我想在使用者端定義組件（在某種意義上是建構函式）並實例化它。\
我希望實例具有 n1、n2 和 updateComponent 等屬性。\
因此，讓我們考慮將這些封裝為組件實例。

讓我們在 `~/packages/runtime-core/component.ts` 中定義一個叫做 `ComponentInternalInstance` 的東西。\
這將是實例的類型。

```ts
export interface ComponentInternalInstance {
  type: Component // 原始使用者定義的組件（舊的 rootComponent（實際上不僅僅是根組件））
  vnode: VNode // 稍後解釋
  subTree: VNode // 舊的 n1
  next: VNode | null // 舊的 n2
  effect: ReactiveEffect // 舊的 effect
  render: InternalRenderFunction // 舊的 componentRender
  update: () => void // 舊的 updateComponent
  isMounted: boolean
}

export type InternalRenderFunction = {
  (): VNodeChild
}
```

這個實例擁有的 vnode、subTree 和 next 屬性有點複雜，但從現在開始，我們將實現它，以便可以將 ConcreteComponent 指定為 VNode 的類型。\
在 instance.vnode 中，我們將保留 VNode 本身。\
而 subTree 和 next 將保存該組件的渲染結果 VNode。（這與之前的 n1 和 n2 相同）

在圖像方面，

```ts
const MyComponent = {
  setup() {
    return h('p', {}, ['hello'])
  },
}

const App = {
  setup() {
    return h(MyComponent, {}, [])
  },
}
```

您可以像這樣使用它，如果讓實例成為 MyComponent 的實例，instance.vnode 將保存 `h(MyComponent, {}, [])` 的結果，instance.subTree 將保存 `h("p", {}, ["hello"])` 的結果。

現在，讓我們實現它，以便您可以將組件指定為 h 函式的第一個參數。\
但是，這只是接收定義組件的物件作為類型的問題。\
在 `~/packages/runtime-core/vnode.ts` 中

```ts
export type VNodeTypes = string | typeof Text | object // 添加 object;
```

在 `~/packages/runtime-core/h.ts` 中

```ts
export function h(
  type: string | object, // 添加 object
  props: VNodeProps
) {..}
```

讓我們也確保 VNode 有一個組件實例。

```ts
export interface VNode<HostNode = any> {
  // .
  // .
  // .
  component: ComponentInternalInstance | null // 添加
}
```

因此，渲染器也需要處理組件。\
實現類似於 `processElement` 和 `processText` 的 `processComponent` 來處理組件，並且還實現 `mountComponent` 和 `patchComponent`（或 `updateComponent`）。

首先，讓我們從概述和詳細說明開始。

```ts
const patch = (n1: VNode | null, n2: VNode, container: RendererElement) => {
  const { type } = n2
  if (type === Text) {
    processText(n1, n2, container)
  } else if (typeof type === 'string') {
    processElement(n1, n2, container)
  } else if (typeof type === 'object') {
    // 添加分支
    processComponent(n1, n2, container)
  } else {
    // do nothing
  }
}

const processComponent = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
) => {
  if (n1 == null) {
    mountComponent(n2, container)
  } else {
    updateComponent(n1, n2)
  }
}

const mountComponent = (initialVNode: VNode, container: RendererElement) => {
  // TODO:
}

const updateComponent = (n1: VNode, n2: VNode) => {
  // TODO:
}
```

現在，讓我們看看 `mountComponent`。有三件事要做。

1. 創建組件的實例。
2. 執行 `setup` 函式並將結果儲存在實例中。
3. 創建 `ReactiveEffect` 並將其儲存在實例中。

首先，讓我們在 `component.ts` 中實現一個函式來創建組件的實例（類似於建構函式）。

```ts
export function createComponentInstance(
  vnode: VNode,
): ComponentInternalInstance {
  const type = vnode.type as Component

  const instance: ComponentInternalInstance = {
    type,
    vnode,
    next: null,
    effect: null!,
    subTree: null!,
    update: null!,
    render: null!,
    isMounted: false,
  }

  return instance
}
```

雖然每個屬性的類型都是非空的，但我們在創建實例時用 null 初始化它們（遵循原始 Vue.js 的設計）。

```ts
const mountComponent = (initialVNode: VNode, container: RendererElement) => {
  const instance: ComponentInternalInstance = (initialVNode.component =
    createComponentInstance(initialVNode))
  // TODO: setup component
  // TODO: setup effect
}
```

接下來是 `setup` 函式。\
我們需要將之前直接在 `render` 函式中編寫的程式碼移動到這裡，並將結果儲存在實例中而不是使用變數。

```ts
const mountComponent = (initialVNode: VNode, container: RendererElement) => {
  const instance: ComponentInternalInstance = (initialVNode.component =
    createComponentInstance(initialVNode))

  const component = initialVNode.type as Component
  if (component.setup) {
    instance.render = component.setup() as InternalRenderFunction
  }

  // TODO: setup effect
}
```

最後，讓我們將創建 effect 的程式碼合併到一個名為 `setupRenderEffect` 的函式中。\
同樣，主要任務是將之前直接在 `render` 函式中實現的程式碼移動到這裡，同時利用實例的狀態。

```ts
const mountComponent = (initialVNode: VNode, container: RendererElement) => {
  const instance: ComponentInternalInstance = (initialVNode.component =
    createComponentInstance(initialVNode))

  const component = initialVNode.type as Component
  if (component.setup) {
    instance.render = component.setup() as InternalRenderFunction
  }

  setupRenderEffect(instance, initialVNode, container)
}

const setupRenderEffect = (
  instance: ComponentInternalInstance,
  initialVNode: VNode,
  container: RendererElement,
) => {
  const componentUpdateFn = () => {
    const { render } = instance

    if (!instance.isMounted) {
      // mount process
      const subTree = (instance.subTree = normalizeVNode(render()))
      patch(null, subTree, container)
      initialVNode.el = subTree.el
      instance.isMounted = true
    } else {
      // patch process
      let { next, vnode } = instance

      if (next) {
        next.el = vnode.el
        next.component = instance
        instance.vnode = next
        instance.next = null
      } else {
        next = vnode
      }

      const prevTree = instance.subTree
      const nextTree = normalizeVNode(render())
      instance.subTree = nextTree

      patch(prevTree, nextTree, hostParentNode(prevTree.el!)!) // ※ 1
      next.el = nextTree.el
    }
  }

  const effect = (instance.effect = new ReactiveEffect(componentUpdateFn))
  const update = (instance.update = () => effect.run()) // 註冊到 instance.update
  update()
}
```

※ 1: 請在 `nodeOps` 中實現一個名為 `parentNode` 的函式，用於檢索父 Node。

```ts
parentNode: (node) => {
    return node.parentNode;
},
```

我認為這並不特別困難，儘管有點長。\
在 `setupRenderEffect` 函式中，更新函式被註冊為實例的 `update` 方法，所以在 `updateComponent` 中，我們只需要呼叫該函式。

```ts
const updateComponent = (n1: VNode, n2: VNode) => {
  const instance = (n2.component = n1.component)!
  instance.next = n2
  instance.update()
}
```

最後，由於到目前為止在 `render` 函式中定義的實現不再需要，我們將刪除它。

```ts
const render: RootRenderFunction = (rootComponent, container) => {
  const vnode = createVNode(rootComponent, {}, [])
  patch(null, vnode, container)
}
```

現在我們可以渲染組件了。讓我們嘗試創建一個 `playground` 組件作為示例。\
通過這種方式，我們可以將渲染分為組件。

```ts
import { createApp, h, reactive } from 'chibivue'

const CounterComponent = {
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => state.count++

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, ['increment']),
      ])
  },
}

const app = createApp({
  setup() {
    return () =>
      h('div', { id: 'my-app' }, [
        h(CounterComponent, {}, []),
        h(CounterComponent, {}, []),
        h(CounterComponent, {}, []),
      ])
  },
})

app.mount('#app')
```

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/050_component_system)
