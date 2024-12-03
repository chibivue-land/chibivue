# Let's enable rendering HTML elements

## What is the h function?

So far, we have made the following source code work:

```ts
import { createApp } from 'vue'

const app = createApp({
  render() {
    return 'Hello world.'
  },
})

app.mount('#app')
```

This is a function that simply renders "Hello World." on the screen.  
Since it's a bit lonely with just a message, let's think about a developer interface that can also render HTML elements.  
That's where the `h function` comes in. This `h` stands for `hyperscript` and is provided as a function for writing HTML (Hyper Text Markup Language) in JavaScript.

> h() is short for hyperscript - which means "JavaScript that produces HTML (hypertext markup language)". This name is inherited from conventions shared by many Virtual DOM implementations. A more descriptive name could be createVnode(), but a shorter name helps when you have to call this function many times in a render function.

Quote: https://vuejs.org/guide/extras/render-function.html#creating-vnodes

Let's take a look at the h function in Vue.js.

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

As a basic usage of the h function, you specify the tag name as the first argument, attributes as the second argument, and an array of child elements as the third argument.  
Here, I specifically mentioned "basic usage" because the h function actually has multiple syntaxes for its arguments, and you can omit the second argument or not use an array for child elements.  
However, here we will implement it in the most basic syntax.

## How should we implement it? 🤔

Now that we understand the developer interface, let's decide how to implement it.  
The important point to note is how it is used as the return value of the render function.  
This means that the `h` function returns some kind of object and uses that result internally.
Since it is difficult to understand with complex child elements, let's consider the result of implementing a simple h function.

```ts
const result = h('div', { class: 'container' }, ['hello'])
```

What kind of result should be stored in `result`? (How should we format the result and how should we render it?)

Let's assume that the following object is stored in `result`:

```ts
const result = {
  type: 'div',
  props: { class: 'container' },
  children: ['hello'],
}
```

In other words, we will receive an object similar to the one above from the render function and use it to perform DOM operations and render it.
The image is like this (inside the `mount` of `createApp`):

```ts
const app: App = {
  mount(rootContainer: HostElement) {
    const node = rootComponent.render!()
    render(node, rootContainer)
  },
}
```

Well, the only thing that has changed is that we changed the `message` string to an `node` object.  
All we have to do now is perform DOM operations based on the object in the render function.

Actually, this object has a name, "Virtual DOM".  
We will explain more about the Virtual DOM in the Virtual DOM chapter, so for now, just remember the name.

## Implementing the h function

First, create the necessary files.

```sh
pwd # ~
touch packages/runtime-core/vnode.ts
touch packages/runtime-core/h.ts
```

Define the types in vnode.ts. This is all we will do in vnode.ts.

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

Next, implement the function body in h.ts.

```ts
export function h(
  type: string,
  props: VNodeProps,
  children: (VNode | string)[],
) {
  return { type, props, children }
}
```

For now, let's try using the h function in the playground.

```ts
import { createApp, h } from 'chibivue'

const app = createApp({
  render() {
    return h('div', {}, ['Hello world.'])
  },
})

app.mount('#app')
```

The display on the screen is broken, but if you add a log in apiCreateApp, you can see that it is working as expected.

```ts
mount(rootContainer: HostElement) {
  const vnode = rootComponent.render!();
  console.log(vnode); // Check the log
  render(vnode, rootContainer);
},
```

Now, let's implement the render function.
Implement `createElement`, `createText`, and `insert` in RendererOptions.

```ts
export interface RendererOptions<HostNode = RendererNode> {
  createElement(type: string): HostNode // Added

  createText(text: string): HostNode // Added

  setElementText(node: HostNode, text: string): void

  insert(child: HostNode, parent: HostNode, anchor?: HostNode | null): void // Added
}
```

Implement the `renderVNode` function in the render function. For now, we are ignoring the `props`.

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

In the nodeOps of runtime-dom, define the actual DOM operations.

```ts
export const nodeOps: RendererOptions<Node> = {
  // Added
  createElement: tagName => {
    return document.createElement(tagName)
  },

  // Added
  createText: (text: string) => {
    return document.createTextNode(text)
  },

  setElementText(node, text) {
    node.textContent = text
  },

  // Added
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null)
  },
}
```

Well, at this point, you should be able to render elements on the screen.
Try writing and testing various things in the playground!

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

Yay! Now we can use the h function to render various tags!

![](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/simple_h_function.png)
