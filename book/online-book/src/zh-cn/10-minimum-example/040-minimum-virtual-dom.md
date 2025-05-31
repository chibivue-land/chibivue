# 最小虚拟 DOM

## 虚拟 DOM 用于什么？

通过在上一章中引入响应式系统，我们能够动态更新屏幕。让我们再次查看当前渲染函数的内容。

```ts
const render: RootRenderFunction = (vnode, container) => {
  while (container.firstChild) container.removeChild(container.firstChild)
  const el = renderVNode(vnode)
  hostInsert(el, container)
}
```

有些人可能在上一章中注意到这个函数中有很多浪费。

看看游乐场。

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

问题是当执行 increment 时，只有 `count: ${state.count}` 部分发生变化，但在 renderVNode 中，所有 DOM 元素都被删除并从头重新创建。这感觉非常浪费。\
虽然现在看起来工作正常，因为它仍然很小，但您可以很容易地想象，如果您在开发 Web 应用程序时每次都必须从头重新创建复杂的 DOM，性能将大大降低。\
因此，由于我们已经有了虚拟 DOM，我们希望实现一个比较当前虚拟 DOM 与之前虚拟 DOM 的实现，并仅使用 DOM 操作更新存在差异的部分。\
现在，这是本章的主要主题。

让我们看看我们想在源代码中做什么。当我们有像上面这样的组件时，渲染函数的返回值变成如下的虚拟 DOM。在初始渲染时，计数为 0，所以它看起来像这样：

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

让我们保留这个 vnode 并为下一次渲染准备另一个 vnode。以下是第一次点击按钮时的 vnode：

```ts
const nextVnode = {
  type: "div",
  props: { id: "my-app" },
  children: [
    {
      type: "p",
      props: {},
      children: [`count: 1`] // 只想更新这部分
    },
    {
      type: "button",
      { onClick: increment },
      ["increment"]
    }
  ]
}
```

现在，有了这两个 vnodes，屏幕处于 vnode 的状态（在它变成 nextVnode 之前）。\
我们希望将这两个传递给一个名为 patch 的函数，并仅渲染差异。

```ts
const vnode = {...}
const nextVnode = {...}
patch(vnode, nextVnode, container)
```

我之前介绍了函数名，但这种差异渲染称为"patch"。\
有时也称为"reconciliation"。通过使用这两个虚拟 DOM，您可以高效地更新屏幕。

## 在实现 patch 函数之前

这与主要主题没有直接关系，但让我们在这里做一个轻微的重构（因为这对我们接下来要讨论的内容很方便）。\
让我们在 vnode.ts 中创建一个名为 createVNode 的函数，并让 h 函数调用它。

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

也更改 h 函数。

```ts
export function h(
  type: string,
  props: VNodeProps,
  children: (VNode | string)[],
) {
  return createVNode(type, props, children)
}
```

现在，让我们进入正题。到目前为止，VNode 拥有的小元素的类型一直是 `(Vnode | string)[]`，但仅将 Text 视为字符串是不够的，所以让我们尝试将其统一为 VNode。\
Text 不仅仅是一个字符串，它作为 HTML TextElement 存在，所以它包含的信息比仅仅一个字符串更多。\
我们希望将其视为 VNode 以便处理周围的信息。\
具体来说，让我们使用符号 Text 将其作为 VNode 的类型。\
例如，当有像 `"hello"` 这样的文本时，

```ts
{
  type: Text,
  props: null,
  children: "hello"
}
```

是表示形式。

另外，这里需要注意的一点是，当执行 h 函数时，我们将继续使用传统的表达式，我们将通过在渲染函数中应用名为 normalize 的函数来转换它，以表示如上所述的 Text。这样做是为了匹配原始的 Vue.js。

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

// 规范化后的类型
export type VNodeNormalizedChildren = string | VNodeArrayChildren;
export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>;

export type VNodeChild = VNodeChildAtom | VNodeArrayChildren;
type VNodeChildAtom = VNode | string;

export function createVNode(..){..} // 省略

// 实现 normalize 函数（在 renderer.ts 中使用）
export function normalizeVNode(child: VNodeChild): VNode {
  if (typeof child === "object") {
    return { ...child } as VNode;
  } else {
    // 将字符串转换为前面介绍的所需形式
    return createVNode(Text, null, String(child));
  }
}
```

现在 Text 可以被视为 VNode。

## patch 函数的设计

首先，让我们看看代码库中 patch 函数的设计。\
（我们不需要在这里实现它，只需理解它。）\
patch 函数比较两个 vnodes，vnode1 和 vnode2。但是，vnode1 最初不存在。\
因此，patch 函数分为两个过程："初始（从 vnode2 生成 dom）"和"更新 vnode1 和 vnode2 之间的差异"。\
这些过程分别命名为"mount"和"patch"。\
它们分别对 ElementNode 和 TextNode 执行（结合为"process"，每个都有"mount"和"patch"名称）。

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

## 实际实现

现在让我们实际实现虚拟 DOM 的 patch 函数。\
首先，我们希望在 vnode 挂载时在 vnode 中有对实际 DOM 的引用，无论它是 Element 还是 Text。\
所以我们向 vnode 添加"el"属性。

`~/packages/runtime-core/vnode.ts`

```ts
export interface VNode<HostNode = RendererNode> {
  type: VNodeTypes
  props: VNodeProps | null
  children: VNodeNormalizedChildren
  el: HostNode | undefined // [!code ++]
}
```

现在让我们转到 `~/packages/runtime-core/renderer.ts`。\
我们将在 `createRenderer` 函数内部实现它并删除 `renderVNode` 函数。

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

让我们从 `processElement` 和 `mountElement` 开始实现。

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

由于它是一个元素，我们还需要挂载其子元素。\
让我们使用我们之前创建的 `normalize` 函数。

```ts
const mountChildren = (children: VNode[], container: RendererElement) => {
  for (let i = 0; i < children.length; i++) {
    const child = (children[i] = normalizeVNode(children[i]))
    patch(null, child, container)
  }
}
```

这样，我们已经实现了元素的挂载。\
接下来，让我们转到挂载 Text。\
但是，这只是一个简单的 DOM 操作。\
在设计说明中，我们将其分为 `mountText` 和 `patchText` 函数，但由于处理不多，并且预计将来不会变得更复杂，让我们直接编写它。

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

现在，随着初始渲染的挂载完成，让我们将一些处理从 `createAppAPI` 中的 `mount` 函数移动到 `render` 函数，以便我们可以保存两个 vnodes。\
具体来说，我们将 `rootComponent` 传递给 `render` 函数并在其中执行 ReactiveEffect 注册。

```ts
return function createApp(rootComponent) {
  const app: App = {
    mount(rootContainer: HostElement) {
      // 只传递 rootComponent
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

现在，让我们尝试在游乐场中渲染，看看它是否工作！

由于我们还没有实现 patch 函数，屏幕不会更新。

所以，让我们继续编写 patch 函数。

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

Text 节点也是如此。

```ts
const processText = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
) => {
  if (n1 == null) {
    hostInsert((n2.el = hostCreateText(n2.children as string)), container)
  } else {
    // 添加 patch 逻辑
    const el = (n2.el = n1.el!)
    if (n2.children !== n1.children) {
      hostSetText(el, n2.children as string)
    }
  }
}
```

※ 关于 patchChildren，通常我们需要通过添加 key 属性来处理动态长度的子元素，但由于我们正在实现一个小的虚拟 DOM，我们不会在这里涵盖其实用性。\
如果您感兴趣，请参考基础虚拟 DOM 部分。\
在这里，我们的目标是在一定程度上理解虚拟 DOM 的实现和作用。

现在我们可以执行差异渲染，让我们看看游乐场。

![patch_rendering](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/patch_rendering.png)

我们已经成功使用虚拟 DOM 实现了补丁！！！！！恭喜！

到此为止的源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/040_vdom_system)
