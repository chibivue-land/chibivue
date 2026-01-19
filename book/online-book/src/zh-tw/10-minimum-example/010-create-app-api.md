# 第一次渲染和 createApp API

## 從哪裡開始？

現在，讓我們開始逐步實現 chibivue．我們應該如何進行實現？

這是作者在創建新東西時總是牢記的一點：首先，思考軟體將如何被使用．\
為了方便起見，讓我們稱之為「開發者介面」．

這裡，「開發者」指的是使用 chibivue 開發 Web 應用程式的人，而不是 chibivue 本身的開發者．\
換句話說，在開發 chibivue 時，讓我們參考原始 Vue.js 的開發者介面作為參考．\
具體來說，讓我們看看在使用 Vue.js 開發 Web 應用程式時要寫什麼．

## 開發者介面層級？

我們在這裡需要注意的是，Vue.js 有多個開發者介面，每個介面都有不同的層級．這裡，層級指的是它與原始 JavaScript 的接近程度．\
例如，以下是使用 Vue 顯示 HTML 的開發者介面示例：

1. 在單文件組件中編寫模板

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

2. 使用 template 選項

```ts
import { createApp } from 'vue'

const app = createApp({
  template: '<div>Hello world.</div>',
})

app.mount('#app')
```

3. 使用 render 選項和 h 函數

```ts
import { createApp, h } from 'vue'

const app = createApp({
  render() {
    return h('div', {}, ['Hello world.'])
  },
})

app.mount('#app')
```

還有其他選項，但讓我們考慮這三個開發者介面．\
哪一個最接近原始 JavaScript？答案是「使用 render 選項和 h 函數」（選項 3）．\
選項 1 需要實現 SFC 編譯器和打包器（或載入器），選項 2 需要編譯傳遞給模板的 HTML（將其轉換為 JavaScript 代碼）才能工作．

為了方便起見，讓我們稱更接近原始 JS 的開發者介面為「低級開發者介面」．\
這裡重要的是「從低級部分開始實現」．\
原因是在許多情況下，高級描述被轉換為低級描述並執行．\
換句話說，選項 1 和 2 最終都在內部轉換為選項 3 的形式．\
這種轉換的實現稱為「編譯器」．

所以，讓我們從實現像選項 3 這樣的開發者介面開始！

## createApp API 和渲染

雖然我們的目標是選項 3 的形式，但我們仍然不太了解 h 函數，而且由於這本書的目標是增量開發，讓我們不要立即瞄準選項 3 的形式．\
相反，讓我們從實現一個返回要顯示的消息的簡單渲染函數開始．

圖像 ↓

```ts
import { createApp } from 'vue'

const app = createApp({
  render() {
    return 'Hello world.'
  },
})

app.mount('#app')
```

## 立即實現

讓我們在 `~/packages/index.ts` 中創建 createApp 函數．\
注意：由於不需要輸出「Hello, World」，我們將刪除它．

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

這非常簡單．讓我們在遊樂場中試試．

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

我們能夠在螢幕上顯示消息！做得好！

![hello_createApp](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/hello_createApp.png)

到此為止的源代碼：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/010_create_app)
