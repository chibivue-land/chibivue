# 什麼是 Vue.js？

## 關於 Vue.js 的快速回顧

讓我們直奔主題。  
但在此之前，讓我們快速回顧一下 Vue.js 的全部內容。

## Vue.js 到底是什麼？

Vue.js 是一個「友好、高性能、多功能的構建 Web 用戶界面的框架」。  
這是官方文檔主頁上的說明。  
對此，我認為直接引用官方的話而不添加我自己的解釋會更清楚，所以我在下面引用了它們：

> Vue（發音為 /vjuː/，類似 view）是一個用於構建用戶界面的 JavaScript 框架。它建立在標準 HTML、CSS 和 JavaScript 的基礎上，並提供了一套聲明式的、組件化的編程模型，幫助你高效地開發用戶界面，無論是簡單還是複雜的。

> 聲明式渲染：Vue 基於標準 HTML 拓展了一套模板語法，使得我們可以聲明式地描述最終輸出的 HTML 和 JavaScript 狀態之間的關係。

> 響應性：Vue 會自動跟蹤 JavaScript 狀態變化並在改變發生時響應式地更新 DOM。

> 這裡是一個最小的示例：
>
> ```ts
> import { createApp } from 'vue'
>
> createApp({
>   data() {
>     return {
>       count: 0,
>     }
>   },
> }).mount('#app')
> ```
>
> ```html
> <div id="app">
>   <button @click="count++">Count is: {{ count }}</button>
> </div>
> ```

[參考來源](https://vuejs.org/guide/introduction.html#what-is-vue)

對於聲明式渲染和響應性，我們將在各自的章節中詳細深入探討，所以現在有一個高層次的理解就足夠了。

另外，這裡出現了「框架」這個術語，Vue.js 將自己推廣為「漸進式框架」。關於這一點，我認為最好直接參考文檔的以下部分：

https://vuejs.org/guide/introduction.html#the-progressive-framework

## 官方文檔和本書的區別

官方文檔專注於「如何使用 Vue.js」，提供了大量的教程和指南。

然而，這本書採用了稍微不同的方法，專注於「Vue.js 是如何實現的」。我們將編寫實際代碼來創建一個迷你版本的 Vue.js。

另外，這本書不是官方出版物，可能不夠詳盡。可能會有一些錯誤或遺漏，所以我很感謝任何反饋或更正。
