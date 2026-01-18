## Surrounding Knowledge

<KawaikoNote variant="question" title="What is SFC?">

SFC is a Vue-specific format that combines template, script, and style in one file.
It's saved as `.vue` files and converted to JavaScript by build tools!

</KawaikoNote>

## How is SFC implemented?

Now, let's finally start working on supporting Single File Component (SFC).  
So, how should we go about supporting it? SFC, like templates, is used during development and does not exist in the runtime.  
For those of you who have finished developing the template, I think it's a simple matter of how to compile it.

You just need to convert the following SFC code:

```vue
<script>
export default {
  setup() {
    const state = reactive({ message: 'Hello, chibivue!' })
    const changeMessage = () => {
      state.message += '!'
    }

    return { state, changeMessage }
  },
}
</script>

<template>
  <div class="container" style="text-align: center">
    <h2>message: {{ state.message }}</h2>
    <img
      width="150px"
      src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
      alt="Vue.js Logo"
    />
    <p><b>chibivue</b> is the minimal Vue.js</p>

    <button @click="changeMessage">click me!</button>
  </div>
</template>

<style>
.container {
  height: 100vh;
  padding: 16px;
  background-color: #becdbe;
  color: #2c3e50;
}
</style>
```

into the following JS code:

```ts
export default {
  setup() {
    const state = reactive({ message: 'Hello, chibivue!' })
    const changeMessage = () => {
      state.message += '!'
    }

    return { state, changeMessage }
  },

  render(_ctx) {
    return h('div', { class: 'container', style: 'text-align: center' }, [
      h('h2', `message: ${_ctx.state.message}`),
      h('img', {
        width: '150px',
        src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png',
      }),
      h('p', [h('b', 'chibivue'), ' is the minimal Vue.js']),
      h('button', { onClick: _ctx.changeMessage }, 'click me!'),
    ])
  },
}
```

You may be wondering about the styles! But for now, let's forget about that and focus on the template and script.\
We will not cover `script setup` in the minimum example.

## When and how should we compile?

In conclusion, "we compile when the build tool resolves the dependencies".
In most cases, SFC is imported and used from other files.
At this time, we write a plugin that compiles the `.vue` file when it is resolved and binds the result to the App.

```ts
import App from './App.vue' // Compile when App.vue is imported

const app = createApp(App)
app.mount('#app')
```

There are various build tools, but this time let's try writing a plugin for Vite.

Since there may be few people who have never written a Vite plugin, let's start by getting familiar with plugin implementation using a simple sample code. Let's create a simple Vue project for now.

```sh
pwd # ~
pnpm dlx create-vite
## ✔ Project name: … plugin-sample
## ✔ Select a framework: › Vue
## ✔ Select a variant: › TypeScript

cd plugin-sample
ni
```

Let's take a look at the vite.config.ts file of the created project.

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
})
```

You can see that it adds `@vitejs/plugin-vue` to the plugins.
Actually, when creating a Vue project with Vite, SFC can be used thanks to this plugin.
This plugin implements the SFC compiler according to the Vite plugin API, and compiles Vue files into JS files.
Let's try creating a simple plugin in this project.

```ts
import { defineConfig, Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), myPlugin()],
})

function myPlugin(): Plugin {
  return {
    name: 'vite:my-plugin',

    transform(code, id) {
      if (id.endsWith('.sample.js')) {
        let result = ''

        for (let i = 0; i < 100; i++) {
          result += `console.log("HelloWorld from plugin! (${i})");\n`
        }

        result += code

        return { code: result }
      }
    },
  }
}
```

I created it with the name `myPlugin`.\
Since it's simple, I think many of you can understand it without explanation, but I'll explain it just in case.

The plugin conforms to the format required by Vite. \
There are various options, but since this is a simple sample, I only used the `transform` option.\
I recommend checking the official documentation and other resources for more information: https://vitejs.dev/guide/api-plugin.html

In the `transform` function, you can receive `code` and `id`. \
You can think of `code` as the content of the file and `id` as the file name.\
As a return value, you put the result in the `code` property.
You can write different processing for each file type based on the `id`, or modify the `code` to rewrite the content of the file.\
In this case, I added 100 console logs to the beginning of the file's content for files ending with `*.sample.js`.\
Now, let's implement a sample `plugin.sample.js` and check it.

```sh
pwd # ~/plugin-sample
touch src/plugin.sample.js
```

`~/plugin-sample/src/plugin.sample.js`

```ts
function fizzbuzz(n) {
  for (let i = 1; i <= n; i++) {
    i % 3 === 0 && i % 5 === 0
      ? console.log('fizzbuzz')
      : i % 3 === 0
        ? console.log('fizz')
        : i % 5 === 0
          ? console.log('buzz')
          : console.log(i)
  }
}

fizzbuzz(Math.floor(Math.random() * 100) + 1)
```

`~/plugin-sample/src/main.ts`

```ts
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import './plugin.sample.js' // 追加

createApp(App).mount('#app')
```

Let's check it in the browser.

```sh
pwd # ~/plugin-sample
pnpm dev
```

![sample_vite_plugin_console](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/sample_vite_plugin_console.png)

![sample_vite_plugin_source](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/sample_vite_plugin_source.png)

You can see that the source code has been modified properly.

Source code up to this point:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/070_sfc_compiler)