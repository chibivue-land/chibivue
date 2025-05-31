## 周邊知識

## SFC 是如何實現的？

現在，讓我們最終開始支援單檔案組件（SFC）。\
那麼，我們應該如何支援它呢？SFC 就像模板一樣，在開發期間使用，在執行時不存在。\
對於那些已經完成模板開發的人來說，我認為這只是如何編譯它的簡單問題。

你只需要將以下 SFC 程式碼：

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

轉換為以下 JS 程式碼：

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

你可能會想知道樣式！但現在，讓我們忘記這一點，專注於模板和腳本。\
我們不會在最小範例中涵蓋 `script setup`。

## 我們應該何時以及如何編譯？

總之，「我們在建置工具解析相依性時編譯」。
在大多數情況下，SFC 從其他檔案匯入和使用。
此時，我們編寫一個外掛程式，在解析 `.vue` 檔案時編譯它並將結果綁定到應用程式。

```ts
import App from './App.vue' // 匯入 App.vue 時編譯

const app = createApp(App)
app.mount('#app')
```

有各種建置工具，但這次讓我們嘗試為 Vite 編寫一個外掛程式。

由於可能很少有人從未編寫過 Vite 外掛程式，讓我們首先通過一個簡單的範例程式碼熟悉外掛程式實現。讓我們現在創建一個簡單的 Vue 專案。

```sh
pwd # ~
nlx create-vite
## ✔ Project name: … plugin-sample
## ✔ Select a framework: › Vue
## ✔ Select a variant: › TypeScript

cd plugin-sample
ni
```

讓我們看看創建專案的 vite.config.ts 檔案。

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
})
```

你可以看到它將 `@vitejs/plugin-vue` 添加到外掛程式中。
實際上，當使用 Vite 創建 Vue 專案時，由於這個外掛程式，可以使用 SFC。
這個外掛程式根據 Vite 外掛程式 API 實現 SFC 編譯器，並將 Vue 檔案編譯為 JS 檔案。
讓我們嘗試在這個專案中創建一個簡單的外掛程式。

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

我創建了一個名為 `myPlugin` 的外掛程式。\
由於它很簡單，我認為很多人不用解釋就能理解，但我還是會解釋一下以防萬一。

外掛程式符合 Vite 要求的格式。\
有各種選項，但由於這是一個簡單的範例，我只使用了 `transform` 選項。\
我建議查看官方文件和其他資源以獲取更多資訊：https://vitejs.dev/guide/api-plugin.html

在 `transform` 函式中，你可以接收 `code` 和 `id`。\
你可以將 `code` 視為檔案的內容，將 `id` 視為檔案名。\
作為返回值，你將結果放在 `code` 屬性中。
你可以根據 `id` 為每種檔案類型編寫不同的處理，或修改 `code` 來重寫檔案的內容。\
在這種情況下，我為以 `*.sample.js` 結尾的檔案在檔案內容的開頭添加了 100 個控制台日誌。\
現在，讓我們實現一個範例 `plugin.sample.js` 並檢查它。

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

讓我們在瀏覽器中檢查它。

```sh
pwd # ~/plugin-sample
nr dev
```

![sample_vite_plugin_console](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/sample_vite_plugin_console.png)

![sample_vite_plugin_source](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/sample_vite_plugin_source.png)

你可以看到原始碼已經被正確修改了。

到此為止的原始碼：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/070_sfc_compiler)
