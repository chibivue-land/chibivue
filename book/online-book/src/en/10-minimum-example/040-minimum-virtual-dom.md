# Minimum Virtual DOM

## What is Virtual DOM used for?

By introducing the Reactivity System in the previous chapter, we were able to dynamically update the screen. Let's take a look at the content of the current render function again.

```ts
const render: RootRenderFunction = (vnode, container) => {
  while (container.firstChild) container.removeChild(container.firstChild)
  const el = renderVNode(vnode)
  hostInsert(el, container)
}
```

Some people may have noticed in the previous chapter that there is a lot of waste in this function.

Take a look at the playground.

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

The problem is that only the part that changes when increment is executed is the `count: ${state.count}` part, but in renderVNode, all the DOM elements are removed and recreated from scratch. This feels very wasteful. Although it seems to be working fine for now because it is still small, you can easily imagine that performance will be greatly reduced if you have to recreate a complex DOM from scratch every time you develop a web application. Therefore, since we already have a Virtual DOM, we want to implement an implementation that compares the current Virtual DOM with the previous one and only updates the parts where there are differences using DOM operations. Now, this is the main theme of this chapter.

Let's see what we want to do in the source code. When we have a component like the one above, the return value of the render function becomes a Virtual DOM like the following. At the time of the initial rendering, the count is 0, so it looks like this:

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

Let's keep this vnode and have another vnode for the next rendering. The following is the vnode when the first button is clicked:

```ts
const nextVnode = {
  type: "div",
  props: { id: "my-app" },
  children: [
    {
      type: "p",
      props: {},
      children: [`count: 1`] // Only want to update this part
    },
    {
      type: "button",
      { onClick: increment },
      ["increment"]
    }
  ]
}
```

Now, with these two vnodes, the screen is in the state of vnode (before it becomes nextVnode). We want to pass these two to a function called patch and render only the differences.

```ts
const vnode = {...}
const nextVnode = {...}
patch(vnode, nextVnode, container)
```

I introduced the function name earlier, but this differential rendering is called "patch". It is also sometimes called "reconciliation". By using these two Virtual DOMs, you can efficiently update the screen.

## Before implementing the patch function

This is not directly related to the main topic, but let's do a slight refactoring here (because it is convenient for what we are going to talk about next). Let's create a function called createVNode in vnode.ts and make h function call it.

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

Change h function as well.

```ts
export function h(
  type: string,
  props: VNodeProps,
  children: (VNode | string)[],
) {
  return createVNode(type, props, children)
}
```

Now, let's get to the main point. Until now, the type of the small element that VNode has has been `(Vnode | string)[]`, but it is not enough to treat Text as a string, so let's try to unify it as VNode. Text is not just a string, but it exists as an HTML TextElement, so it contains more information than just a string. We want to treat it as a VNode in order to handle the surrounding information. Specifically, let's use the symbol Text to have it as the type of VNode. For example, when there is a text like `"hello"`,

```ts
{
  type: Text,
  props: null,
  children: "hello"
}
```

is the representation.

Also, one thing to note here is that when h function is executed, we will continue to use the conventional expression, and we will convert it by applying a function called normalize in the render function to represent Text as mentioned above. This is done to match the original Vue.js.

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

// Type after normalization
export type VNodeNormalizedChildren = string | VNodeArrayChildren;
export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>;

export type VNodeChild = VNodeChildAtom | VNodeArrayChildren;
type VNodeChildAtom = VNode | string;

export function createVNode(..){..} // omitted

// Implement the normalize function (used in renderer.ts)
export function normalizeVNode(child: VNodeChild): VNode {
  if (typeof child === "object") {
    return { ...child } as VNode;
  } else {
    // Convert string to the desired form introduced earlier
    return createVNode(Text, null, String(child));
  }
}
```

Now Text can be treated as a VNode.

## Design of the patch function

First, let's take a look at the design of the patch function in the codebase. (We don't need to implement it here, just understand it.) The patch function compares two vnodes, vnode1 and vnode2. However, vnode1 does not exist initially. Therefore, the patch function is divided into two processes: "initial (generating dom from vnode2)" and "updating the difference between vnode1 and vnode2". These processes are named "mount" and "patch" respectively. And they are performed separately for ElementNode and TextNode (combined as "process" with the name "mount" and "patch" for each).

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

## Actual implementation

Now let's actually implement the patch function for the Virtual DOM. First, we want to have a reference to the actual DOM in the vnode when it is mounted, whether it is an Element or a Text. So we add the "el" property to the vnode.

`~/packages/runtime-core/vnode.ts`

```ts
export interface VNode<HostNode = RendererNode> {
  type: VNodeTypes
  props: VNodeProps | null
  children: VNodeNormalizedChildren
  el: HostNode | undefined // [!code ++]
}
```

Now let's move on to `~/packages/runtime-core/renderer.ts`. We will implement it inside the `createRenderer` function and remove the `renderVNode` function.

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

Let's start implementing from `processElement` and `mountElement`.

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

Since it is an element, we also need to mount its children. Let's use the `normalize` function we created earlier.

```ts
const mountChildren = (children: VNode[], container: RendererElement) => {
  for (let i = 0; i < children.length; i++) {
    const child = (children[i] = normalizeVNode(children[i]))
    patch(null, child, container)
  }
}
```

With this, we have implemented the mounting of elements. Next, let's move on to mounting Text. However, this is just a simple DOM operation. In the design explanation, we divided it into `mountText` and `patchText` functions, but since there is not much processing and it is not expected to become more complex in the future, let's write it directly.

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

Now, with the mounting of the initial render completed, let's move some of the processing from the `mount` function in `createAppAPI` to the `render` function so that we can hold two vnodes. Specifically, we pass `rootComponent` to the `render` function and perform ReactiveEffect registration inside it.

```ts
return function createApp(rootComponent) {
  const app: App = {
    mount(rootContainer: HostElement) {
      // Just pass rootComponent
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

Now, let's try to render in the playground to see if it works!

Since we haven't implemented the patch function yet, the screen won't be updated.

So, let's continue writing the patch function.

```ts
const patchElement = (n1: VNode, n2: VNode) => {
  const el = (n2.el = n1.el!)

  const props = n2.props

  patchChildren(n1, n2, el)

  for (const key in props) {
    if (props[key] !== n1.props?.[key] ?? {}) {
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

The same goes for Text nodes.

```ts
const processText = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
) => {
  if (n1 == null) {
    hostInsert((n2.el = hostCreateText(n2.children as string)), container)
  } else {
    // Add patch logic
    const el = (n2.el = n1.el!)
    if (n2.children !== n1.children) {
      hostSetText(el, n2.children as string)
    }
  }
}
```

※ Regarding patchChildren, normally we need to handle dynamic-length child elements by adding key attributes, but since we are implementing a small Virtual DOM, we won't cover the practicality of that here. If you are interested, please refer to the Basic Virtual DOM section. Here, we aim to understand the implementation and role of Virtual DOM up to a certain extent.

Now that we can perform diff rendering, let's take a look at the playground.

![patch_rendering](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/patch_rendering.png)

We have successfully implemented patching using Virtual DOM!!!!! Congratulations!

Source code up to this point: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/040_vdom_system)
