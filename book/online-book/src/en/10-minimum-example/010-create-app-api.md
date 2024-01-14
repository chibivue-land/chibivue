# First Rendering and createApp API

## Vue.js Developer Interface

## Where to start? 🤔

Now, let's start implementing chibivue step by step. How should we proceed with the implementation?

This is something the author always keeps in mind when creating something new: first, think about how the software will be used. For convenience, let's call this "Developer Interface".

Here, "developer" refers to the person who develops web applications using chibivue, not the developer of chibivue itself. In other words, let's refer to the developer interface of the original Vue.js as a reference when developing chibivue. Specifically, let's take a look at what to write when developing web applications with Vue.js.

## Developer Interface Levels? 🤔

What we need to be careful about here is that Vue.js has multiple developer interfaces, each with a different level. Here, the level refers to how close it is to raw JavaScript. For example, the following are examples of developer interfaces for displaying HTML with Vue:

1. Write the template in Single File Component

```vue
<!-- App.vue -->
<template>
  <div>Hello world.</div>
</template>
```

```ts
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
app.mount('#app')
```

2. Use the template option

```ts
import { createApp } from 'vue'

const app = createApp({
  template: '<div>Hello world.</div>',
})

app.mount('#app')
```

3. Use the render option and h function

```ts
import { createApp, h } from 'vue'

const app = createApp({
  render() {
    return h('div', {}, ['Hello world.'])
  },
})

app.mount('#app')
```

There are other options as well, but let's consider these three developer interfaces. Which one is closest to raw JavaScript? The answer is "using the render option and h function" (option 3). Option 1 requires the implementation of the SFC compiler and bundler, and option 2 requires compiling the HTML passed to the template (converting it to JavaScript code) in order to work.

For convenience, let's call the developer interface that is closer to raw JS "low-level developer interface". And the important thing here is to "start implementing from the low-level part". The reason for this is that in many cases, high-level descriptions are converted to low-level descriptions and executed. In other words, both option 1 and 2 are ultimately converted internally to the form of option 3. The implementation of this conversion is called a "compiler".

So, let's start by implementing a developer interface like option 3!

## createApp API and Rendering

## Approach

Although we aim for the form of option 3, we still don't understand the h function well, and since this book aims for incremental development, let's not aim for the form of option 3 right away. Instead, let's start by implementing a simple rendering function that returns a message to be displayed.

Image ↓

```ts
import { createApp } from 'vue'

const app = createApp({
  render() {
    return 'Hello world.'
  },
})

app.mount('#app')
```

## Implementing it right away

Let's create the createApp function in `~/packages/index.ts`. (We will remove helloChibivue as it is unnecessary.)

```ts
export type Options = {
  render: () => string
}

export type App = {
  mount: (selector: string) => void
}

export const createApp = (options: Options): App => {
  return {
    mount: selector => {
      const root = document.querySelector(selector)
      if (root) {
        root.innerHTML = options.render()
      }
    },
  }
}
```

It's very simple. Let's try it in the playground.

`~/examples/playground/src/main.ts`

```ts
import { createApp } from 'chibivue'

const app = createApp({
  render() {
    return 'Hello world.'
  },
})

app.mount('#app')
```

We were able to display the message on the screen! Well done!

![hello_createApp](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/hello_createApp.png)

Source code up to this point:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/010_create_app)

## Refactoring

You might think, "Huh? We've only implemented this much and you want to refactor?" But one of the goals of this book is to "be able to read the Vue.js source code."

With that in mind, I want to always be conscious of the file and directory structure in the style of Vue.js. So, please allow me to do a little refactoring...

### Vue.js Design

#### runtime-core and runtime-dom

Let me explain a little about the structure of the official Vue.js. In this refactoring, we will create two directories: "runtime-core" and "runtime-dom".

To explain what each of them is, "runtime-core" contains the core functionality of Vue.js runtime. It may be difficult to understand what is core and what is not at this stage.

So, I think it would be easier to understand by looking at the relationship with "runtime-dom". As the name suggests, "runtime-dom" is a directory that contains DOM-dependent implementations. Roughly speaking, it can be understood as "browser-dependent operations". It includes DOM operations such as querySelector and createElement.

In runtime-core, we don't write such operations, but instead, we design it to describe the core logic of Vue.js runtime in the world of pure TypeScript. For example, it includes implementations related to Virtual DOM and Components. Well, I think it will become clearer as the development of chibivue progresses, so if you don't understand, please refactor as described in the book for now.

#### Roles and Dependencies of Each File

We will now create some files in runtime-core and runtime-dom. The necessary files are as follows:

```sh
pwd # ~
mkdir packages/runtime-core
mkdir packages/runtime-dom

## core
touch packages/runtime-core/index.ts
touch packages/runtime-core/apiCreateApp.ts
touch packages/runtime-core/component.ts
touch packages/runtime-core/componentOptions.ts
touch packages/runtime-core/renderer.ts

## dom
touch packages/runtime-dom/index.ts
touch packages/runtime-dom/nodeOps.ts
```

As for the roles of these files, it may be difficult to understand just by explaining in words, so please refer to the following diagram:

![refactor_createApp!](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/refactor_createApp.png)

#### Design of the Renderer

As mentioned earlier, Vue.js separates the parts that depend on the DOM from the pure core functionality of Vue.js. First, I want you to pay attention to the renderer factory in "runtime-core" and the nodeOps in "runtime-dom". In the example we implemented earlier, we directly rendered in the mount method of the app returned by createApp.

```ts
// This is the code from earlier
export const createApp = (options: Options): App => {
  return {
    mount: selector => {
      const root = document.querySelector(selector)
      if (root) {
        root.innerHTML = options.render() // Rendering
      }
    },
  }
}
```

At this point, the code is short and not complex at all, so it seems fine at first glance. However, it will become much more complex as we write the patch rendering logic for the Virtual DOM in the future. In Vue.js, this part responsible for rendering is separated as "renderer". That is "runtime-core/renderer.ts". When it comes to rendering, it is easy to imagine that it depends on the API (document) that controls the DOM in the browser in an SPA (creating elements, setting text, etc.). Therefore, in order to separate this part that depends on the DOM from the core rendering logic of Vue.js, some tricks have been made. Here's how it works:

- Implement an object in `runtime-dom/nodeOps` for DOM operations.
- Implement a factory function in `runtime-core/renderer` that generates an object that only contains the logic for rendering. In doing so, make sure to pass the object that handles nodes (not limited to DOM) as an argument to the factory function.
- Use the factories for `nodeOps` and `renderer` in `runtime-dom/index.ts` to complete the renderer.

This is the part highlighted in red in the diagram.
![refactor_createApp_render](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/refactor_createApp_render.png)

Let me explain the source code. At this point, the rendering feature of the Virtual DOM has not been implemented yet, so we will create it with the same functionality as before.

First, implement the interface for the object used for node (not limited to DOM) operations in `runtime-core/renderer`.

```ts
export interface RendererOptions<HostNode = RendererNode> {
  setElementText(node: HostNode, text: string): void
}

export interface RendererNode {
  [key: string]: any
}

export interface RendererElement extends RendererNode {}
```

Currently, there is only the `setElementText` function, but you can imagine that functions like `createElement` and `removeChild` will be implemented in the future.

Regarding `RendererNode` and `RendererElement`, please ignore them for now. (The implementation here is just defining a generic type for objects that become nodes, without depending on the DOM.)  
Implement the renderer factory function in this file, which takes `RendererOptions` as an argument.

```ts
export type RootRenderFunction<HostElement = RendererElement> = (
  message: string,
  container: HostElement,
) => void

export function createRenderer(options: RendererOptions) {
  const { setElementText: hostSetElementText } = options

  const render: RootRenderFunction = (message, container) => {
    hostSetElementText(container, message) // In this case, we are simply inserting the message, so the implementation is like this
  }

  return { render }
}
```

Next, implement the `nodeOps` in `runtime-dom/nodeOps`.

```ts
import { RendererOptions } from '../runtime-core'

export const nodeOps: RendererOptions<Node> = {
  setElementText(node, text) {
    node.textContent = text
  },
}
```

There is nothing particularly difficult here.

Now, let's complete the renderer in `runtime-dom/index.ts`.

```ts
import { createRenderer } from '../runtime-core'
import { nodeOps } from './nodeOps'

const { render } = createRenderer(nodeOps)
```

With this, the refactoring of the renderer is complete.

#### DI and DIP

Let's take a look at the design of the renderer. To summarize:

- Implement a factory function in `runtime-core/renderer` to generate the renderer.
- Implement an object in `runtime-dom/nodeOps` for operations (manipulations) that depend on the DOM.
- Combine the factory function and `nodeOps` in `runtime-dom/index` to generate the renderer.

These are the concepts of "DIP" and "DI". First, let's talk about DIP (Dependency Inversion Principle). By implementing an interface, we can invert the dependency. What you should pay attention to is the `RendererOptions` interface implemented in `renderer.ts`. Both the factory function and `nodeOps` should adhere to this `RendererOptions` interface (depend on the `RendererOptions` interface). By using this, we perform DI. Dependency Injection (DI) is a technique that reduces dependency by injecting an object that an object depends on from the outside. In this case, the renderer depends on an object that implements `RendererOptions` (in this case, `nodeOps`). Instead of implementing this dependency directly from the renderer, we receive it as an argument to the factory. By using these techniques, we make sure that the renderer does not depend on the DOM.

DI and DIP may be difficult concepts if you are not familiar with them, but they are important techniques that are often used, so I hope you can research and understand them on your own.

### Completing createApp

Now, let's get back to the implementation. Now that the renderer has been generated, all we need to do is consider the red area in the following diagram.

![refactor_createApp_createApp](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/refactor_createApp_createApp.png)

However, it's a simple task. We just need to implement the factory function for createApp so that it can accept the renderer we created earlier.

```ts
// ~/packages/runtime-core apiCreateApp.ts

import { Component } from './component'
import { RootRenderFunction } from './renderer'

export interface App<HostElement = any> {
  mount(rootContainer: HostElement | string): void
}

export type CreateAppFunction<HostElement> = (
  rootComponent: Component,
) => App<HostElement>

export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent) {
    const app: App = {
      mount(rootContainer: HostElement) {
        const message = rootComponent.render!()
        render(message, rootContainer)
      },
    }

    return app
  }
}
```

```ts
// ~/packages/runtime-dom/index.ts

import {
  CreateAppFunction,
  createAppAPI,
  createRenderer,
} from '../runtime-core'
import { nodeOps } from './nodeOps'

const { render } = createRenderer(nodeOps)
const _createApp = createAppAPI(render)

export const createApp = ((...args) => {
  const app = _createApp(...args)
  const { mount } = app
  app.mount = (selector: string) => {
    const container = document.querySelector(selector)
    if (!container) return
    mount(container)
  }

  return app
}) as CreateAppFunction<Element>
```

I moved the types to `~/packages/runtime-core/component.ts`, but that's not important, so please refer to the source code (it's just aligning with the original Vue.js).

Now that we are closer to the source code of the original Vue.js, let's test it. If the message is still displayed, it's OK.

Source code up to this point:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/010_create_app2)
