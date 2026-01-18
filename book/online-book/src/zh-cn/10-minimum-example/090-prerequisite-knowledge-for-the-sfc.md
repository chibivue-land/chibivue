## 周边知识

## SFC 是如何实现的？

现在，让我们最终开始支持单文件组件（SFC）．\
那么，我们应该如何支持它呢？SFC 就像模板一样，在开发期间使用，在运行时不存在．\
对于那些已经完成模板开发的人来说，我认为这只是如何编译它的简单问题．

你只需要将以下 SFC 代码：

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

转换为以下 JS 代码：

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

你可能会想知道样式！但现在，让我们忘记这一点，专注于模板和脚本．\
我们不会在最小示例中涵盖 `script setup`．

## 我们应该何时以及如何编译？

总之，"我们在构建工具解析依赖项时编译"．
在大多数情况下，SFC 从其他文件导入和使用．
此时，我们编写一个插件，在解析 `.vue` 文件时编译它并将结果绑定到应用程序．

```ts
import App from './App.vue' // 导入 App.vue 时编译

const app = createApp(App)
app.mount('#app')
```

有各种构建工具，但这次让我们尝试为 Vite 编写一个插件．

由于可能很少有人从未编写过 Vite 插件，让我们首先通过一个简单的示例代码熟悉插件实现．让我们现在创建一个简单的 Vue 项目．

```sh
pwd # ~
pnpm dlx create-vite
## ✔ Project name: … plugin-sample
## ✔ Select a framework: › Vue
## ✔ Select a variant: › TypeScript

cd plugin-sample
ni
```

让我们看看创建项目的 vite.config.ts 文件．

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
})
```

你可以看到它将 `@vitejs/plugin-vue` 添加到插件中．
实际上，当使用 Vite 创建 Vue 项目时，由于这个插件，可以使用 SFC．
这个插件根据 Vite 插件 API 实现 SFC 编译器，并将 Vue 文件编译为 JS 文件．
让我们尝试在这个项目中创建一个简单的插件．

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

我创建了一个名为 `myPlugin` 的插件．\
由于它很简单，我认为很多人不用解释就能理解，但我还是会解释一下以防万一．

插件符合 Vite 要求的格式．\
有各种选项，但由于这是一个简单的示例，我只使用了 `transform` 选项．\
我建议查看官方文档和其他资源以获取更多信息：https://vitejs.dev/guide/api-plugin.html

在 `transform` 函数中，你可以接收 `code` 和 `id`．\
你可以将 `code` 视为文件的内容，将 `id` 视为文件名．\
作为返回值，你将结果放在 `code` 属性中．
你可以根据 `id` 为每种文件类型编写不同的处理，或修改 `code` 来重写文件的内容．\
在这种情况下，我为以 `*.sample.js` 结尾的文件在文件内容的开头添加了 100 个控制台日志．\
现在，让我们实现一个示例 `plugin.sample.js` 并检查它．

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
import './plugin.sample.js' // 添加

createApp(App).mount('#app')
```

让我们在浏览器中检查它．

```sh
pwd # ~/plugin-sample
pnpm dev
```

![sample_vite_plugin_console](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/sample_vite_plugin_console.png)

![sample_vite_plugin_source](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/sample_vite_plugin_source.png)

你可以看到源代码已经被正确修改了．

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/070_sfc_compiler)
