# First Rendering and createApp API

## Where to start? 🤔

Now, let's start implementing chibivue step by step. How should we proceed with the implementation?

<KawaikoNote variant="question" title="Let's start implementing!">

This is the exciting moment to dive into Vue.js internals!
"Where to start" is actually an important point.

</KawaikoNote>

This is something the author always keeps in mind when creating something new: first, think about how the software will be used. \
For convenience, let's call this "Developer Interface".

Here, "developer" refers to the person who develops web applications using chibivue, not the developer of chibivue itself.\
In other words, let's refer to the developer interface of the original Vue.js as a reference when developing chibivue. \
Specifically, let's take a look at what to write when developing web applications with Vue.js.

## Developer Interface Levels? 🤔

What we need to be careful about here is that Vue.js has multiple developer interfaces, each with a different level. Here, the level refers to how close it is to raw JavaScript. \
For example, the following are examples of developer interfaces for displaying HTML with Vue:

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

There are other options as well, but let's consider these three developer interfaces. \
Which one is closest to raw JavaScript? The answer is "using the render option and h function" (option 3). \
Option 1 requires the implementation of the SFC compiler and bundler (or loader), and option 2 requires compiling the HTML passed to the template (converting it to JavaScript code) in order to work.

For convenience, let's call the developer interface that is closer to raw JS "low-level developer interface".\
And the important thing here is to "start implementing from the low-level part". \
The reason for this is that in many cases, high-level descriptions are converted to low-level descriptions and executed. \
In other words, both option 1 and 2 are ultimately converted internally to the form of option 3. \
The implementation of this conversion is called a "compiler".

<KawaikoNote variant="funny" title="Start from low-level!">

"Low-level" might sound weak, but it's actually the opposite!
It's the foundation, and without a solid foundation, you can't build higher-level features.

</KawaikoNote>

So, let's start by implementing a developer interface like option 3!

## createApp API and Rendering

Although we aim for the form of option 3, we still don't understand the h function well, and since this book aims for incremental development, let's not aim for the form of option 3 right away. \
Instead, let's start by implementing a simple rendering function that returns a message to be displayed.

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

Let's create the createApp function in `~/packages/index.ts`. \
Note: Since the output of "Hello, World" is not necessary, we will remove it.

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

![hello_createApp](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/hello_createApp.png)

<KawaikoNote variant="surprise" title="First step complete!">

With just a few dozen lines of code, a Vue.js-style app is running!
This small step is a big step toward understanding frameworks.

</KawaikoNote>

Source code up to this point:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/010_create_app)
