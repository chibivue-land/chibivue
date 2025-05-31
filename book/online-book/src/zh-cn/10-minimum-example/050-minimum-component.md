# 我想使用基于组件的方法进行开发

## 基于整理现有实现的思考

到目前为止，我们已经小规模地实现了 createApp API、响应式系统和虚拟 DOM 系统。\
通过当前的实现，我们可以使用响应式系统动态更改 UI，并使用虚拟 DOM 系统执行高效渲染。\
然而，作为开发者接口，所有内容都写在 createAppAPI 中。\
实际上，我想更多地分割文件并实现通用组件以实现可重用性。\
首先，让我们回顾一下现有实现中当前混乱的部分。请查看 renderer.ts 中的 render 函数。

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

在 render 函数中，直接定义了关于根组件的信息。\
实际上，n1、n2、updateComponent 和 effect 对每个组件都存在。\
事实上，从现在开始，我想在用户端定义组件（在某种意义上是构造函数）并实例化它。\
我希望实例具有 n1、n2 和 updateComponent 等属性。\
因此，让我们考虑将这些封装为组件实例。

让我们在 `~/packages/runtime-core/component.ts` 中定义一个叫做 `ComponentInternalInstance` 的东西。\
这将是实例的类型。

```ts
export interface ComponentInternalInstance {
  type: Component // 原始用户定义的组件（旧的 rootComponent（实际上不仅仅是根组件））
  vnode: VNode // 稍后解释
  subTree: VNode // 旧的 n1
  next: VNode | null // 旧的 n2
  effect: ReactiveEffect // 旧的 effect
  render: InternalRenderFunction // 旧的 componentRender
  update: () => void // 旧的 updateComponent
  isMounted: boolean
}

export type InternalRenderFunction = {
  (): VNodeChild
}
```

这个实例拥有的 vnode、subTree 和 next 属性有点复杂，但从现在开始，我们将实现它，以便可以将 ConcreteComponent 指定为 VNode 的类型。\
在 instance.vnode 中，我们将保留 VNode 本身。\
而 subTree 和 next 将保存该组件的渲染结果 VNode。（这与之前的 n1 和 n2 相同）

在图像方面，

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

您可以像这样使用它，如果让实例成为 MyComponent 的实例，instance.vnode 将保存 `h(MyComponent, {}, [])` 的结果，instance.subTree 将保存 `h("p", {}, ["hello"])` 的结果。

现在，让我们实现它，以便您可以将组件指定为 h 函数的第一个参数。\
但是，这只是接收定义组件的对象作为类型的问题。\
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

让我们也确保 VNode 有一个组件实例。

```ts
export interface VNode<HostNode = any> {
  // .
  // .
  // .
  component: ComponentInternalInstance | null // 添加
}
```

因此，渲染器也需要处理组件。\
实现类似于 `processElement` 和 `processText` 的 `processComponent` 来处理组件，并且还实现 `mountComponent` 和 `patchComponent`（或 `updateComponent`）。

首先，让我们从概述和详细说明开始。

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

现在，让我们看看 `mountComponent`。有三件事要做。

1. 创建组件的实例。
2. 执行 `setup` 函数并将结果存储在实例中。
3. 创建 `ReactiveEffect` 并将其存储在实例中。

首先，让我们在 `component.ts` 中实现一个函数来创建组件的实例（类似于构造函数）。

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

虽然每个属性的类型都是非空的，但我们在创建实例时用 null 初始化它们（遵循原始 Vue.js 的设计）。

```ts
const mountComponent = (initialVNode: VNode, container: RendererElement) => {
  const instance: ComponentInternalInstance = (initialVNode.component =
    createComponentInstance(initialVNode))
  // TODO: setup component
  // TODO: setup effect
}
```

接下来是 `setup` 函数。\
我们需要将之前直接在 `render` 函数中编写的代码移动到这里，并将结果存储在实例中而不是使用变量。

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

最后，让我们将创建 effect 的代码合并到一个名为 `setupRenderEffect` 的函数中。\
同样，主要任务是将之前直接在 `render` 函数中实现的代码移动到这里，同时利用实例的状态。

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
  const update = (instance.update = () => effect.run()) // 注册到 instance.update
  update()
}
```

※ 1: 请在 `nodeOps` 中实现一个名为 `parentNode` 的函数，用于检索父 Node。

```ts
parentNode: (node) => {
    return node.parentNode;
},
```

我认为这并不特别困难，尽管有点长。\
在 `setupRenderEffect` 函数中，更新函数被注册为实例的 `update` 方法，所以在 `updateComponent` 中，我们只需要调用该函数。

```ts
const updateComponent = (n1: VNode, n2: VNode) => {
  const instance = (n2.component = n1.component)!
  instance.next = n2
  instance.update()
}
```

最后，由于到目前为止在 `render` 函数中定义的实现不再需要，我们将删除它。

```ts
const render: RootRenderFunction = (rootComponent, container) => {
  const vnode = createVNode(rootComponent, {}, [])
  patch(null, vnode, container)
}
```

现在我们可以渲染组件了。让我们尝试创建一个 `playground` 组件作为示例。\
通过这种方式，我们可以将渲染分为组件。

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

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/050_component_system)
