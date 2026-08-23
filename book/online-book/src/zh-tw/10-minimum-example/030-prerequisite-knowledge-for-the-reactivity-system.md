# 響應式系統的先決知識

## 這次我們的目標開發者介面

從這裡開始，我們將討論 Vue.js 的精髓，即響應式系統。

<KawaikoNote variant="surprise" title="重頭戲來了！">

這是 Vue.js 的核心！\
一旦理解了響應式系統，你就會明白 Vue.js 的「魔法」是如何實作的。\
雖然有點難，但讓我們一起努力吧！

</KawaikoNote>

之前的實作雖然看起來類似於 Vue.js，但在功能上實際上並不是 Vue.js。
我只是實作了初始的開發者介面，並使其能夠顯示各種 HTML。

然而，就目前而言，一旦螢幕被渲染，它就保持不變，作為一個 Web 應用程式，它變成了一個靜態站點。
從現在開始，我們將加入狀態來建立更豐富的 UI，並在狀態改變時更新渲染。

首先，讓我們像往常一樣思考它將是什麼樣的開發者介面。
這樣如何？

```ts
import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })

    const increment = () => {
      state.count++
    }

    return () =>
      h('div', { id: 'my-app' }, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, ['increment']),
      ])
  },
})

app.mount('#app')
```

如果您習慣於使用單檔案元件（SFC）進行開發，這可能看起來有點不熟悉。
這是一個使用 `setup` 選項來儲存狀態並回傳渲染函式的開發者介面。
實際上，Vue.js 有這樣的表示法。

https://vuejs.org/api/composition-api-setup.html#usage-with-render-functions

我們用 `reactive` 函式定義狀態，實作一個名為 `increment` 的函式來修改它，並將其綁定到按鈕的點擊事件。
總結我們想要做的事情：

- 執行 `setup` 函式以從回傳值取得用於取得 vnode 的函式
- 使傳遞給 `reactive` 函式的物件變為響應式
- 當按鈕被點擊時，狀態被更新
- 跟蹤狀態更新，重新執行渲染函式，並重繪螢幕

## 什麼是響應式系統？

現在，讓我們回顧一下什麼是響應式。
讓我們參考官方文件。

> 響應式物件是 JavaScript Proxy，其行為與一般物件相似。不同之處在於 Vue 可以追蹤響應式物件的屬性存取與變更。

[來源](https://vuejs.org/guide/essentials/reactivity-fundamentals)

> Vue 最獨特的功能之一是其謙遜的響應式系統。元件的狀態由響應式 JavaScript 物件組成。當狀態改變時，視圖會更新。

[來源](https://vuejs.org/guide/extras/reactivity-in-depth.html)

總之，「響應式物件在有變化時更新螢幕」。
讓我們暫時擱置如何實作這一點，並實作前面提到的開發者介面。

## setup 函式的實作

我們需要做的非常簡單。
我們接收 `setup` 選項並執行它，然後我們可以像之前的 `render` 選項一樣使用它。

編輯 `~/packages/runtime-core/componentOptions.ts`：

```ts
export type ComponentOptions = {
  render?: Function
  setup?: () => Function // 加入
}
```

然後使用它：

```ts
// createAppAPI

const app: App = {
  mount(rootContainer: HostElement) {
    const componentRender = rootComponent.setup!()

    const updateComponent = () => {
      const vnode = componentRender()
      render(vnode, rootContainer)
    }

    updateComponent()
  },
}
```

```ts
// playground

import { createApp, h } from 'chibivue'

const app = createApp({
  setup() {
    // 將來在這裡定義狀態
    // const state = reactive({ count: 0 })

    return function render() {
      return h('div', { id: 'my-app' }, [
        h('p', { style: 'color: red; font-weight: bold;' }, ['Hello world.']),
        h(
          'button',
          {
            onClick() {
              alert('Hello world!')
            },
          },
          ['click me!'],
        ),
      ])
    }
  },
})

app.mount('#app')
```

嗯，就是這樣。
實際上，我們希望在狀態改變時執行這個 `updateComponent`。

## 代理物件

這是這次的主要主題。我想在狀態以某種方式改變時執行 `updateComponent`。

關鍵是一個名為 Proxy 的物件。

<KawaikoNote variant="question" title="Proxy 是什麼？">

Proxy 是 JavaScript 的標準功能，不是 Vue.js 發明的。\
可以理解為「監看並自訂物件存取行為的機制」！\
透過它，我們可以檢測到「值被讀取」或「值被修改」。

</KawaikoNote>

首先，讓我解釋一下它們，而不是關於響應式系統的實作方法。

https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Proxy

Proxy 是一個非常有趣的物件。

您可以透過將物件作為參數傳遞並像這樣使用 `new` 來使用它：

```ts
const o = new Proxy({ value: 1 }, {})
console.log(o.value) // 1
```

在這個例子中，`o` 的行為幾乎與普通物件相同。

現在，有趣的是 Proxy 可以接受第二個參數並註冊一個處理器。
這個處理器是物件操作的處理器。請看以下示例：

```ts
const o = new Proxy(
  { value: 1, value2: 2 },

  {
    get(target, key, receiver) {
      console.log(`target:${target}, key: ${key}`)
      return target[key]
    },
  },
)
```

在這個例子中，我們正在為產生的物件編寫設定。
具體來說，存取（get）此物件的屬性時，主控台會輸出原始物件（target）和被存取的鍵名。
讓我們在瀏覽器或其他地方檢查操作。

![Proxy get trap console output](/figures/10-minimum-example/reactivity/proxy-get-trap.png)

您可以看到為從此 Proxy 產生的物件的屬性讀取值而設定的 set 處理正在執行。

同樣，您也可以為 set 設定它。

```ts
const o = new Proxy(
  { value: 1, value2: 2 },
  {
    set(target, key, value, receiver) {
      console.log('hello from setter')
      target[key] = value
      return true
    },
  },
)
```

![Proxy set trap console output](/figures/10-minimum-example/reactivity/proxy-set-trap.png)

<KawaikoNote variant="funny" title="這就是響應式的秘密！">

用 get 檢測「讀取」，用 set 檢測「寫入」...\
也就是說，在 set 的時機呼叫「更新螢幕的處理」，就能實作 **值變化時自動更新螢幕** 的魔法！

</KawaikoNote>

這就是理解 Proxy 的程度。
