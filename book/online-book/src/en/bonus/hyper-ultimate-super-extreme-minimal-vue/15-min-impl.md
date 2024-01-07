# Hyper Ultimate Super Extreme Minimal Vue

## Project Setup (0.5 min)

```sh
# Clone this repository and navigate to it.
git clone https://github.com/Ubugeeei/chibivue
cd chibivue

# Create a project using the setup command.
# Specify the root path of the project as an argument.
nr setup ../my-chibivue-project
```

The project setup is now complete.

Let's now implement packages/index.ts.

## createApp (1 min)

For the create app function, let's consider a signature that allows specifying the setup and render functions. From the user's perspective, it would be used like this:

```ts
const app = createApp({
  setup() {
    // TODO:
  },
  render() {
    // TODO:
  },
})

app.mount('#app')
```

Let's implement it:

```ts
type CreateAppOption = {
  setup: () => Record<string, unknown>
  render: (ctx: Record<string, unknown>) => VNode
}
```

We can then return an object that implements the mount function:

```ts
export const createApp = (option: CreateAppOption) => ({
  mount(selector: string) {
    const container = document.querySelector(selector)!
    // TODO: patch rendering
  },
})
```

That's it for this part.

## h Function and Virtual DOM (0.5 min)

To perform patch rendering, we need a Virtual DOM and functions to generate it.

The Virtual DOM represents tag names, attributes, and child elements using JavaScript objects. The Vue renderer handles the Virtual DOM and applies updates to the actual DOM.

Let's consider a VNode that represents a name, a click event handler, and child elements (text) for this example:

```ts
type VNode = { tag: string; onClick: (e: Event) => void; children: string }
export const h = (
  tag: string,
  onClick: (e: Event) => void,
  children: string,
): VNode => ({ tag, onClick, children })
```

That's it for this part.

## patch rendering (2 min)

Now let's implement the renderer.

This rendering process is often referred to as patching because it compares the old and new Virtual DOMs and applies the differences to the actual DOM.

The function signature would be:

```ts
export const render = (n1: VNode | null, n2: VNode, container: Element) => {
  // TODO:
}
```

n1 represents the old VNode, n2 represents the new VNode, and container is the root of the actual DOM. In this example, `#app` would be the container (the element mounted with createApp).

We need to consider two types of operations:

- Mount  
  This is the initial rendering. If n1 is null, it means it's the first rendering, so we need to implement the mount process.
- Patch  
  This compares the VNodes and applies the differences to the actual DOM.  
  This time, however, we only update children and do not detect differences.

Let's implement it:

```ts
export const render = (n1: VNode | null, n2: VNode, container: Element) => {
  const mountElement = (vnode: VNode, container: Element) => {
    const el = document.createElement(vnode.tag)
    el.textContent = vnode.children
    el.addEventListener('click', vnode.onClick)
    container.appendChild(el)
  }
  const patchElement = (_n1: VNode, n2: VNode) => {
    ;(container.firstElementChild as Element).textContent = n2.children
  }
  n1 == null ? mountElement(n2, container) : patchElement(n1, n2)
}
```

That's it for this part.

## Reactivity System (2 min)

Now let's implement the logic to track state changes defined in the setup option and trigger the render function. This process of tracking state changes and performing specific actions is called the "Reactivity System."

Let's consider using the `reactive` function to define states:

```ts
const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => state.count++
    return { state, increment }
  },
  // ..
  // ..
})
```

In this case, when a state defined with the `reactive` function is modified, we want to trigger the patch process.

It can achieve this using a Proxy object. Proxies allow us to implement functionality for get/set operations. In this case, we can use the set operation to execute the patch process when a set operation occurs.

```ts
export const reactive = <T extends Record<string, unknown>>(obj: T): T =>
  new Proxy(obj, {
    get: (target, key, receiver) => Reflect.get(target, key, receiver),
    set: (target, key, value, receiver) => {
      const res = Reflect.set(target, key, value, receiver)
      // ??? Here we want to execute the patch process
      return res
    },
  })
```

The question is, what should we trigger in the set operation? Normally, we would track the changes using the get operation, but in this case, we will define an `update` function in the global scope and refer to it.

Let's use the previously implemented render function to create the update function:

```ts
let update: (() => void) | null = null // We want to reference this with Proxy, so it needs to be in the global scope
export const createApp = (option: CreateAppOption) => ({
  mount(selector: string) {
    const container = document.querySelector(selector)!
    let prevVNode: VNode | null = null
    const setupState = option.setup() // Only run setup on the first rendering
    update = () => {
      // Generate a closure to compare prevVNode and VNode
      const vnode = option.render(setupState)
      render(prevVNode, vnode, container)
      prevVNode = vnode
    }
    update()
  },
})
```

Now we just need to call it in the set operation of the Proxy:

```ts
export const reactive = <T extends Record<string, unknown>>(obj: T): T =>
  new Proxy(obj, {
    get: (target, key, receiver) => Reflect.get(target, key, receiver),
    set: (target, key, value, receiver) => {
      const res = Reflect.set(target, key, value, receiver)
      update?.() // Execute the update
      return res
    },
  })
```

That's it!

## template compiler (5 min)

So far, we have been able to implement declarative UI by allowing users to use the render option and the h function. However, in reality, we want to write it in an HTML-like way.

Therefore, let's implement a template compiler that converts HTML to the h function.

The goal is to convert a string like this:

```
<button @click="increment">state: {{ state.count }}</button>
```

to a function like this:

```
h("button", increment, "state: " + state.count)
```

Let's break it down a bit.

- parse  
  Parse the HTML string and convert it into an object called AST (Abstract Syntax Tree).
- codegen  
  Generate the desired code (string) based on the AST.

Now, let's implement AST and parse.

```ts
type AST = {
  tag: string
  onClick: string
  children: (string | Interpolation)[]
}
type Interpolation = { content: string }
```

The AST we are dealing with this time is as shown above. It is similar to VNode, but it is completely different and is used for generating code. Interpolation represents the mustache syntax. A string like <span v-pre>`{{ state.count }}`</span> is parsed into an object (AST) like <span v-pre>`{ content: "state.count" }`</span>.

Next, let's implement the parse function that generates AST from the given string. For now, let's implement it quickly using regular expressions and some string operations.

```ts
const parse = (template: string): AST => {
  const RE = /<([a-z]+)\s@click=\"([a-z]+)\">(.+)<\/[a-z]+>/
  const [_, tag, onClick, children] = template.match(RE) || []
  if (!tag || !onClick || !children) throw new Error('Invalid template!')
  const regex = /{{(.*?)}}/g
  let match: RegExpExecArray | null
  let lastIndex = 0
  const parsedChildren: AST['children'] = []
  while ((match = regex.exec(children)) !== null) {
    lastIndex !== match.index &&
      parsedChildren.push(children.substring(lastIndex, match.index))
    parsedChildren.push({ content: match[1].trim() })
    lastIndex = match.index + match[0].length
  }
  lastIndex < children.length && parsedChildren.push(children.substr(lastIndex))
  return { tag, onClick, children: parsedChildren }
}
```

Next is codegen. Generate the invocation of the h function based on the AST.

```ts
const codegen = (node: AST) =>
  `(_ctx) => h('${node.tag}', _ctx.${node.onClick}, \`${node.children
    .map(child =>
      typeof child === 'object' ? `\$\{_ctx.${child.content}\}` : child,
    )
    .join('')}\`)`
```

The state is referenced from the argument `_ctx`.

By combining these, we can complete the compile function.

```ts
const compile = (template: string): string => codegen(parse(template))
```

Well, actually, as it is, it only generates the invocation of the h function as a string, so it doesn't work yet.

We will implement it together with the sfc compiler.

With this, the template compiler is complete.

## sfc compiler (vite-plugin) (4 min)

Last! Let's implement a plugin for vite to support sfc.

In vite plugins, there is an option called transform, which allows you to transform the contents of a file.

The transform function returns something like `{ code: string }`, and the string is treated as source code. In other words, for example,

```ts
export const VitePluginChibivue = () => ({
  name: "vite-plugin-chibivue",
  transform: (code: string, id: string) => ({
    code: "";
  }),
});
```

will make the content of all files an empty string. The original code can be received as the first argument, so by converting this value properly and returning it at the end, you can transform it.

There are 5 things to do.

- Extract what is exported as default from the script.
- Convert it into code that assigns it to a variable. (For convenience, let's call the variable A.)
- Extract the HTML string from the template and convert it into a call to the h function using the compile function we created earlier. (For convenience, let's call the result B.)
- Generate code like `Object.assign(A, { render: B })`.
- Generate code that exports A as default.

Now let's implement it.

```ts
const compileSFC = (sfc: string): { code: string } => {
  const [_, scriptContent] =
    sfc.match(/<script>\s*([\s\S]*?)\s*<\/script>/) ?? []
  const [___, defaultExported] =
    scriptContent.match(/export default\s*([\s\S]*)/) ?? []
  const [__, templateContent] =
    sfc.match(/<template>\s*([\s\S]*?)\s*<\/template>/) ?? []
  if (!scriptContent || !defaultExported || !templateContent)
    throw new Error('Invalid SFC!')
  let code = ''
  code +=
    "import { h, reactive } from 'hyper-ultimate-super-extreme-minimal-vue';\n"
  code += `const options = ${defaultExported}\n`
  code += `Object.assign(options, { render: ${compile(templateContent)} });\n`
  code += 'export default options;\n'
  return { code }
}
```

After that, implement it in the plugin.

```ts
export const VitePluginChibivue = () => ({
  name: 'vite-plugin-chibivue',
  transform: (code: string, id: string) =>
    id.endsWith('.vue') ? compileSFC(code) : code, // Only for files with the .vue extension
})
```

## The End

Yes. With this, we have successfully implemented until SFC.
Let's take another look at the source code.

```ts
// create app api
type CreateAppOption = {
  setup: () => Record<string, unknown>
  render: (ctx: Record<string, unknown>) => VNode
}
let update: (() => void) | null = null
export const createApp = (option: CreateAppOption) => ({
  mount(selector: string) {
    const container = document.querySelector(selector)!
    let prevVNode: VNode | null = null
    const setupState = option.setup()
    update = () => {
      const vnode = option.render(setupState)
      render(prevVNode, vnode, container)
      prevVNode = vnode
    }
    update()
  },
})

// Virtual DOM patch
export const render = (n1: VNode | null, n2: VNode, container: Element) => {
  const mountElement = (vnode: VNode, container: Element) => {
    const el = document.createElement(vnode.tag)
    el.textContent = vnode.children
    el.addEventListener('click', vnode.onClick)
    container.appendChild(el)
  }
  const patchElement = (_n1: VNode, n2: VNode) => {
    ;(container.firstElementChild as Element).textContent = n2.children
  }
  n1 == null ? mountElement(n2, container) : patchElement(n1, n2)
}

// Virtual DOM
type VNode = { tag: string; onClick: (e: Event) => void; children: string }
export const h = (
  tag: string,
  onClick: (e: Event) => void,
  children: string,
): VNode => ({ tag, onClick, children })

// Reactivity System
export const reactive = <T extends Record<string, unknown>>(obj: T): T =>
  new Proxy(obj, {
    get: (target, key, receiver) => Reflect.get(target, key, receiver),
    set: (target, key, value, receiver) => {
      const res = Reflect.set(target, key, value, receiver)
      update?.()
      return res
    },
  })

// template compiler
type AST = {
  tag: string
  onClick: string
  children: (string | Interpolation)[]
}
type Interpolation = { content: string }
const parse = (template: string): AST => {
  const RE = /<([a-z]+)\s@click=\"([a-z]+)\">(.+)<\/[a-z]+>/
  const [_, tag, onClick, children] = template.match(RE) || []
  if (!tag || !onClick || !children) throw new Error('Invalid template!')
  const regex = /{{(.*?)}}/g
  let match: RegExpExecArray | null
  let lastIndex = 0
  const parsedChildren: AST['children'] = []
  while ((match = regex.exec(children)) !== null) {
    lastIndex !== match.index &&
      parsedChildren.push(children.substring(lastIndex, match.index))
    parsedChildren.push({ content: match[1].trim() })
    lastIndex = match.index + match[0].length
  }
  lastIndex < children.length && parsedChildren.push(children.substr(lastIndex))
  return { tag, onClick, children: parsedChildren }
}
const codegen = (node: AST) =>
  `(_ctx) => h('${node.tag}', _ctx.${node.onClick}, \`${node.children
    .map(child =>
      typeof child === 'object' ? `\$\{_ctx.${child.content}\}` : child,
    )
    .join('')}\`)`
const compile = (template: string): string => codegen(parse(template))

// sfc compiler (vite transformer)
export const VitePluginChibivue = () => ({
  name: 'vite-plugin-chibivue',
  transform: (code: string, id: string) =>
    id.endsWith('.vue') ? compileSFC(code) : null,
})
const compileSFC = (sfc: string): { code: string } => {
  const [_, scriptContent] =
    sfc.match(/<script>\s*([\s\S]*?)\s*<\/script>/) ?? []
  const [___, defaultExported] =
    scriptContent.match(/export default\s*([\s\S]*)/) ?? []
  const [__, templateContent] =
    sfc.match(/<template>\s*([\s\S]*?)\s*<\/template>/) ?? []
  if (!scriptContent || !defaultExported || !templateContent)
    throw new Error('Invalid SFC!')
  let code = ''
  code +=
    "import { h, reactive } from 'hyper-ultimate-super-extreme-minimal-vue';\n"
  code += `const options = ${defaultExported}\n`
  code += `Object.assign(options, { render: ${compile(templateContent)} });\n`
  code += 'export default options;\n'
  return { code }
}
```

Surprisingly, we were able to implement it in about 110 lines. (Now no one will complain, phew...)

Please make sure to also try the main part of the main part!! (This is just an appendix, though 😙)
