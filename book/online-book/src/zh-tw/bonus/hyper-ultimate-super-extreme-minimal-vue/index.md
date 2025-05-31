# chibivue？哪裡小了！？太大了，我處理不了！

## 它很大...

對於那些這樣想的人，我真誠地道歉．

在拿起這本書之前，您可能想像的是更小的東西．

請允許我稍作辯解，即使是我也沒有打算把它做得這麼大．

當我繼續工作時，我發現它很有趣，並想，"哦，我下一步應該新增這個功能嗎？"就這樣變成了這樣．

## 明白了．讓我們設定一個時間限制．

導致它變得太大的因素之一是"沒有時間限制"．

所以，在這個附錄中，我將嘗試在"**15 分鐘**"內實現它．

當然，我也會將解釋限制在一頁內．

此外，不僅是頁面，"實現本身將包含在一個檔案中"也是我將嘗試實現的目標．

但是，即使是一個檔案，在一個檔案中寫 100,000 行也是沒有意義的，所以我將目標是在少於 150 行內實現它．

標題是"**Hyper Ultimate Super Extreme Minimal Vue**"．

::: info 關於名稱

我想很多人認為這個名字相當幼稚．

我也這麼認為．

但是，這個名字有一個合適的理由．

在強調它極其小的同時，我想要一個縮寫，所以就變成了這個詞序．

縮寫是"HUSEM Vue (Balloon Vue)"．

"HU-SEN" [fuːsen] 在日語中意思是"氣球"．

雖然我現在將以一種非常草率的方式實現它，但我將這種草率比作一個"氣球"，即使針碰到它也會爆炸．

:::

## 你只是要實現一個響應式系統，對吧？

不，不是這樣的．這次，我將嘗試列出將在 15 分鐘內實現的內容．

- create app api
- Virtual DOM
- patch rendering
- Reactivity System
- template compiler
- sfc compiler (vite-plugin)

我將實現這些東西．

換句話說，SFC 將工作．

至於原始碼，我假設以下內容將工作：

```vue
<script>
import { reactive } from 'hyper-ultimate-super-extreme-minimal-vue'

export default {
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => state.count++
    return { state, increment }
  },
}
</script>

<template>
  <button @click="increment">state: {{ state.count }}</button>
</template>
```

```ts
import { createApp } from 'hyper-ultimate-super-extreme-minimal-vue'

// @ts-ignore
import App from './App.vue'

const app = createApp(App)
app.mount('#app')
```
