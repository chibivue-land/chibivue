# 介紹

## 本書的目的

感謝您選擇這本書！
如果您對這本書哪怕有一點點興趣，我都感到非常高興。
讓我首先總結一下這本書的目的。

**☆ 目的**

- **深入理解 Vue.js**
  什麼是 Vue.js？它是如何建置的？
- **能夠實作 Vue.js 的基本功能**
  實際嘗試實作基本功能。
- **閱讀 vuejs/core 的原始碼**
  理解實作與官方程式碼之間的關係，掌握它們是如何真正建置的。

我提供了一個大致的目標概述，但沒有必要完成所有目標，也不是要求追求完美。
無論您是從頭到尾閱讀，還是只挑選感興趣的部分，都由您決定。
如果您發現這本書的哪怕一小部分有用，我都會很高興！

## 目標讀者

- **有 Vue.js 使用經驗的人**
- **能夠編寫 TypeScript**

只要具備以上兩點，就不需要其他知識。
閱讀過程中可能會遇到一些陌生術語，但我會盡量減少對先備知識的相依，並隨時補充說明，力求讓本書的內容自成體系。
不過，如果你對 Vue.js 或 TypeScript 的基本操作還不熟悉，建議先透過相應資料掌握基礎知識。
（了解基本功能即可，不需要深入研究。）

## 本書（以及作者）在意並希望做到的事情

在深入之前，我想分享一些我在寫這本書時特別關注的事情。
我希望您在閱讀時記住這些，如果有任何我沒有達到目標的地方，請告訴我。

- **消除對先驗知識的需求**
  雖然這可能與前面提到的「目標讀者」部分重疊，但我努力使這本書盡可能自成體系，
  最大限度地減少對先驗知識的需求，並根據需要提供解釋。
  這是因為我希望讓盡可能多的讀者看到清楚易懂的講解。
  經驗較為豐富的讀者可能會覺得有些說明比較冗長，還請見諒。

- **增量實作**
  本書的目標之一是手工增量實作 Vue.js。這意味著本書專注於實踐方法，
  在實作方面，我強調以小的增量步驟建置。
  更具體地說，就是「最小化非工作狀態」。
  而不是擁有直到完成才能工作的東西，目標是在每個階段都保持其功能。
  這也符合我自己的編碼習慣——一直編寫無法執行的程式碼很容易讓人洩氣。
  即使不完美，總是有東西在執行會使過程更愉快。
  這是關於體驗小勝利，比如「是的！現在它工作到這一點了！」

- **避免對特定框架，庫或語言的偏見**
  雖然這本書專注於 Vue.js，但今天有無數優秀的框架，庫和語言。
  事實上，除了 Vue.js 之外，我還有我的最愛，我經常從用它們建置的見解和服務中受益。
  這本書的目的純粹是「理解 Vue.js」，不涉及對其他工具的排名或判斷。

## 本線上書籍的主題和結構

由於這本書變得相當龐大，我設定了成就里程碑並將其分為不同的部分。

- **最小示例部分**
   在這裡，Vue.js 以最基本的形式實作。
   雖然這一部分涵蓋了最小的功能集，但它將處理
   虛擬 DOM，響應式系統，編譯器和 SFC（單檔案元件）支援。
   然而，這些實作遠非實用，並且高度簡化。
   不過，如果你只是想從整體上了解 Vue.js，這一部分已經足夠。
   作為介紹性部分，這裡的解釋比其他部分更詳細。
   完成本部分後，你在閱讀 Vue.js 官方原始碼時應該會更從容一些。在功能上，程式碼大致可以做到以下這些事情……

  ```vue
  <script>
  import { reactive } from 'chibivue'

  export default {
    setup() {
      const state = reactive({ message: 'Hello, chibivue!', input: '' })

      const changeMessage = () => {
        state.message += '!'
      }

      const handleInput = e => {
        state.input = e.target?.value ?? ''
      }

      return { state, changeMessage, handleInput }
    },
  }
  </script>

  <template>
    <div class="container" style="text-align: center">
      <h2>{{ state.message }}</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
        alt="Vue.js Logo"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <button @click="changeMessage">click me!</button>

      <br />

      <label>
        Input Data
        <input @input="handleInput" />
      </label>

      <p>input value: {{ state.input }}</p>
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

  ```ts
  import { createApp } from 'chibivue'
  import App from './App.vue'

  const app = createApp(App)

  app.mount('#app')
  ```

- **基礎虛擬 DOM 部分**
  在這一部分中，我們將為虛擬 DOM 實作較為實用的 patch 渲染。雖然不會實作 [Suspense](https://vuejs.org/guide/built-ins/suspense) 等功能或更多最佳化，但它足以處理基本的渲染工作。我們也會在這裡實作排程器。

- **基礎響應式系統部分**
  雖然我們在最小示例部分實作了 reactive API，但在這一部分中我們將實作其他 API。從 ref，watch 和 computed 等基本 API 開始，我們還將深入研究 effectScope 和 shallow 系列等更高階的 API。

- **基礎元件系統部分**
  在這裡，我們將承擔與元件系統相關的基本實作。事實上，由於我們已經在基礎虛擬 DOM 部分為元件系統設定了基礎，這裡我們將專注於元件系統的其他方面。這包括 props/emit，provide/inject，響應式系統的擴充和生命週期鉤子等功能。

- **基礎模板編譯器部分**
  除了在基礎虛擬 DOM 部分實作的虛擬 DOM 系統編譯器之外，我們將實作 v-on，v-bind 和 v-for 等指令。通常，這將涉及元件的 template 選項，我們不會在這裡涵蓋 SFC（單檔案元件）。

- **基礎 SFC 編譯器部分**
  在這裡，我們會以「基礎模板編譯器」部分的成果為基礎，實作一個具備基本實用性的 SFC 編譯器。
  具體來說，我們將實作 script setup 和編譯器巨集。
  在這一點上，體驗將非常接近使用常規 Vue。

- **Web 應用程式要點部分**
  完成基礎 SFC 編譯器部分後，我們就擁有了一套基本可用的 Vue.js 功能。不過，要開發 Web 應用程式仍缺少不少能力，例如全域狀態管理和路由。在這一部分中，我們將開發這些周邊外掛，讓 chibivue 在 Web 應用程式開發中更加實用。

## 關於本書的意見和問題

我打算盡我所能回應關於這本書的問題和反饋。請隨時在 Twitter 上聯繫我（透過 DM 或直接在時間線上）。由於我已經公開了儲存庫，您也可以在那裡發布問題。我知道我自己的理解並不完美，所以我感謝任何反饋。如果您發現任何解釋不清楚或具有挑戰性，請不要猶豫詢問。我的目標是向盡可能多的人傳播清晰正確的解釋，我希望我們能夠一起建置這個。

https://x.com/ubugeeei

## 關於 Discord 伺服器

我們為這本書建立了一個 Discord 伺服器！（2024/01/01）
~~在這裡，我們分享公告，為與這本線上書籍相關的問題和技巧提供支援。~~ \
我們也歡迎隨意對話，所以讓我們與其他 chibivue 使用者愉快地交流。
目前，由於有很多日語使用者，大部分對話都是日語，但非日語使用者也歡迎毫不猶豫地加入！（完全可以使用您的母語）

最近，我們不僅積極為 chibivue 做貢獻，還作為 Vue.js 日本社群伺服器的一部分！

### 我們大致做什麼

- 自我介紹（可選）
- 與 chibivue 相關的公告（如更新）
- 分享技巧
- 回答問題
- 響應請求
- 隨意對話

### 如何加入

這是邀請連結: https://discord.gg/aVHvmbmSRy

您也可以從這本書標題右上角的 Discord 按鈕加入。

## 關於作者

**ubugeeei (もののけ王)**

<img class="author-avatar" src="/figures/_people/ubugeeei-avatar.jpg" alt="ubugeeei" width="160" height="160">

[Vue.js](https://vuejs.org/about/team.html) Core Team 成員，[Vue.js Japan User Group](https://github.com/vuejs-jp) Core Staff，[Vite+](https://github.com/voidzero-dev/vite-plus) Core Contributor，[株式会社メイツ](https://github.com/mates-inc) Chief Engineer。\
[chibivue land](https://github.com/chibivue-land) King. https://chibivue.land

我在圍繞 Vue，語言處理器和開發體驗製作工具與書籍，主要包括 [chibivue](https://github.com/chibivue-land/chibivue)，[Vize](https://github.com/ubugeeei/vize)，[Ox Content](https://github.com/ubugeeei/ox-content)，[reading-vuejs-core-vapor](https://github.com/ubugeeei/reading-vuejs-core-vapor) 和 [Vapor Moon](https://github.com/ubugeeei/vapor-moon)。

https://wtrclred.io/

如果您願意，請作為贊助商支援我！ https://github.com/sponsors/ubugeeei

## 贊助商

<div class="sponsors-block">
<a class="sponsors-image-link" href="https://github.com/sponsors/ubugeeei">
  <img class="sponsors-image sponsors-image--light" src="/figures/_sponsors/ubugeeei-sponsors.png" alt="ubugeeei's sponsors" />
  <img class="sponsors-image sponsors-image--dark" src="/figures/_sponsors/ubugeeei-sponsors-dark.png" alt="ubugeeei's sponsors" />
</a>

<p>如果您想支援我的工作，我將非常感激！</p>
<p><a href="https://github.com/sponsors/ubugeeei">https://github.com/sponsors/ubugeeei</a></p>

</div>
