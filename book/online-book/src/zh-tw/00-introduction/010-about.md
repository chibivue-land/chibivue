# 介紹

## 🎯 本書的目的

感謝您選擇這本書！  
如果您對這本書哪怕有一點點興趣，我都感到非常高興．  
讓我首先總結一下這本書的目的．

**☆ 目的**

- **深入理解 Vue.js**  
  什麼是 Vue.js？它是如何構建的？
- **能夠實現 Vue.js 的基本功能**  
  實際嘗試實現基本功能．
- **閱讀 vuejs/core 的源代碼**  
  理解實現與官方代碼之間的關係，掌握它們是如何真正構建的．

我提供了一個大致的目標概述，但沒有必要完成所有目標，也不是要求追求完美．  
無論您是從頭到尾閱讀，還是只挑選感興趣的部分，都由您決定．  
如果您發現這本書的哪怕一小部分有用，我都會很高興！

## 🤷‍♂️ 目標讀者

- **有 Vue.js 使用經驗的人**
- **能夠編寫 TypeScript**

僅有這兩個先決條件，不需要其他知識．  
雖然您在閱讀本書過程中可能會遇到不熟悉的術語，但我已經盡力排除任何先驗知識，並在過程中進行解釋，旨在使這本書自成體系．  
但是，如果您遇到不應該用於 Vue.js 或 TypeScript 的術語，我建議您先從相應的資源中學習．  
（基本功能就足夠了！（不需要深入研究））

## 🙋‍♀️ 本書（和作者）所關注的（並希望實現的）

在深入之前，我想分享一些我在寫這本書時特別關注的事情．  
我希望您在閱讀時記住這些，如果有任何我沒有達到目標的地方，請告訴我．

- **消除對先驗知識的需求**  
  雖然這可能與前面提到的「目標讀者」部分重疊，但我努力使這本書盡可能自成體系，  
  最大限度地減少對先驗知識的需求，並根據需要提供解釋．  
  這是因為我想讓盡可能多的讀者理解盡可能清晰的解釋．  
  有豐富經驗的人可能會發現一些解釋有點冗長，但我請求您的理解．

- **增量實現**  
  本書的目標之一是手工增量實現 Vue.js．這意味著本書專注於實踐方法，  
  在實現方面，我強調以小的增量步驟構建．  
  更具體地說，就是「最小化非工作狀態」．  
  而不是擁有直到完成才能工作的東西，目標是在每個階段都保持其功能．  
  這反映了我個人的編碼方法——持續編寫非功能代碼可能令人沮喪．  
  即使不完美，總是有東西在運行會使過程更愉快．  
  這是關於體驗小勝利，比如「是的！現在它工作到這一點了！」

- **避免對特定框架，庫或語言的偏見**  
  雖然這本書專注於 Vue.js，但今天有無數優秀的框架，庫和語言．  
  事實上，除了 Vue.js 之外，我還有我的最愛，我經常從用它們構建的見解和服務中受益．  
  這本書的目的純粹是「理解 Vue.js」，不涉及對其他工具的排名或判斷．

## 💡 本線上書籍的主題和結構

由於這本書變得相當龐大，我設置了成就里程碑並將其分為不同的部分．

- **最小示例部分**  
   在這裡，Vue.js 以最基本的形式實現．  
   雖然這一部分涵蓋了最小的功能集，但它將處理  
   虛擬 DOM，響應式系統，編譯器和 SFC（單文件組件）支持．  
   然而，這些實現遠非實用，並且高度簡化．  
   但是，對於那些想要 Vue.js 廣泛概述的人來說，這一部分提供了足夠的見解．  
   作為介紹性部分，這裡的解釋比其他部分更詳細．  
   在本部分結束時，讀者應該對閱讀官方 Vue.js 源代碼感到有些舒適．在功能上，您可以期望代碼大致執行以下操作...

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
  在這一部分中，我們將為虛擬 DOM 實現相當實用的補丁渲染功能．雖然我們不會實現像 [Suspense](https://vuejs.org/guide/built-ins/suspense) 或其他優化等功能，但它將足夠熟練地處理基本渲染任務．我們還將在這裡實現調度器．

- **基礎響應式系統部分**
  雖然我們在最小示例部分實現了 reactive API，但在這一部分中我們將實現其他 API．從 ref，watch 和 computed 等基本 API 開始，我們還將深入研究 effectScope 和 shallow 系列等更高級的 API．

- **基礎組件系統部分**
  在這裡，我們將承擔與組件系統相關的基本實現．事實上，由於我們已經在基礎虛擬 DOM 部分為組件系統設置了基礎，這裡我們將專注於組件系統的其他方面．這包括 props/emit，provide/inject，響應式系統的擴展和生命週期鉤子等功能．

- **基礎模板編譯器部分**
  除了在基礎虛擬 DOM 部分實現的虛擬 DOM 系統編譯器之外，我們將實現 v-on，v-bind 和 v-for 等指令．通常，這將涉及組件的 template 選項，我們不會在這裡涵蓋 SFC（單文件組件）．

- **基礎 SFC 編譯器部分**
  在這裡，我們將在利用基礎模板編譯器部分實現的模板編譯器的同時，實現一個有些實用的 SFC 編譯器．
  具體來說，我們將實現 script setup 和編譯器宏．
  在這一點上，體驗將非常接近使用常規 Vue．

- **Web 應用程式要點部分**
  當我們完成基礎 SFC 編譯器部分時，我們將擁有一套有些實用的 Vue.js 功能．然而，要開發 Web 應用程式，仍然缺少很多東西．例如，我們需要管理全局狀態和路由器的工具．在這一部分中，我們將開發這樣的外部插件，旨在從「Web 應用程式開發」的角度使我們的工具包更加實用．

## 🧑‍🏫 關於本書的意見和問題

我打算盡我所能回應關於這本書的問題和反饋．請隨時在 Twitter 上聯繫我（通過 DM 或直接在時間線上）．由於我已經公開了存儲庫，您也可以在那裡發布問題．我知道我自己的理解並不完美，所以我感謝任何反饋．如果您發現任何解釋不清楚或具有挑戰性，請不要猶豫詢問．我的目標是向盡可能多的人傳播清晰正確的解釋，我希望我們能夠一起構建這個 👍．

https://twitter.com/ubugeeei

## 🦀 關於 Discord 伺服器

我們為這本書創建了一個 Discord 伺服器！（2024/01/01）
~~在這裡，我們分享公告，為與這本線上書籍相關的問題和技巧提供支持．~~ \
我們也歡迎隨意對話，所以讓我們與其他 chibivue 用戶愉快地交流．
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

這是邀請連結 👉 https://discord.gg/aVHvmbmSRy

您也可以從這本書標題右上角的 Discord 按鈕加入．

## 關於作者

**ubugeeei (もののけ王)**

<img src="/ubugeeei.jpg" alt="ubugeeei" width="200">

[Vue.js](https://github.com/vuejs) 成員，[Vue.js Japan User Group](https://github.com/vuejs-jp) 核心工作人員．\
[chibivue land](https://github.com/chibivue-land) King. 👉 https://chibivue.land

我還在開發 [vize](https://github.com/ubugeeei/vize)（Rust 製作的 Vue.js 工具鏈）和 [ox-content](https://github.com/ubugeeei/ox-content)（Rust 製作的文檔工具鏈）．

https://wtrclred.io/

如果您願意，請作為贊助商支持我！ 👉 https://github.com/sponsors/ubugeeei

<div align="center">

## 贊助商

<a href="https://github.com/sponsors/ubugeeei">
  <img src="https://raw.githubusercontent.com/ubugeeei/sponsors/main/sponsors.png" alt="ubugeeei's sponsors" />
</a>

如果您想支持我的工作，我將非常感激！

https://github.com/sponsors/ubugeeei

</div>
