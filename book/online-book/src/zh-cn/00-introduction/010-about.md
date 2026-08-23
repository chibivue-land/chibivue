# 介绍

## 本书的目的

感谢您选择这本书！
如果您对这本书哪怕有一点点兴趣，我都感到非常高兴。
让我首先总结一下这本书的目的。

**☆ 目的**

- **深入理解 Vue.js**
  什么是 Vue.js？它是如何构建的？
- **能够实现 Vue.js 的基本功能**
  实际尝试实现基本功能。
- **阅读 vuejs/core 的源代码**
  理解实现与官方代码之间的关系，掌握它们是如何真正构建的。

我提供了一个大致的目标概述，但没有必要完成所有目标，也不是要求追求完美。
无论您是从头到尾阅读，还是只挑选感兴趣的部分，都由您决定。
如果您发现这本书的哪怕一小部分有用，我都会很高兴！

## 目标读者

- **有 Vue.js 使用经验的人**
- **能够编写 TypeScript**

只要具备以上两点，就不需要其他知识。
阅读过程中可能会遇到一些陌生术语，但我会尽量减少对前置知识的依赖，并随时补充说明，力求让本书的内容自成体系。
不过，如果你对 Vue.js 或 TypeScript 的基本操作还不熟悉，建议先通过相应资料掌握基础知识。
（了解基本功能即可，不需要深入研究。）

## 本书（以及作者）在意并希望做到的事情

在深入之前，我想分享一些我在写这本书时特别关注的事情。
我希望您在阅读时记住这些，如果有任何我没有达到目标的地方，请告诉我。

- **消除对先验知识的需求**
  虽然这可能与前面提到的"目标读者"部分重叠，但我努力使这本书尽可能自成体系，
  最大限度地减少对先验知识的需求，并根据需要提供解释。
  这是因为我希望让尽可能多的读者看到清晰易懂的讲解。
  经验较为丰富的读者可能会觉得有些说明比较冗长，还请理解。

- **增量实现**
  本书的目标之一是手工增量实现 Vue.js。这意味着本书专注于实践方法，
  在实现方面，我强调以小的增量步骤构建。
  更具体地说，就是"最小化非工作状态"。
  而不是拥有直到完成才能工作的东西，目标是在每个阶段都保持其功能。
  这也符合我自己的编码习惯——一直编写无法运行的代码很容易让人泄气。
  即使不完美，总是有东西在运行会使过程更愉快。
  这是关于体验小胜利，比如"是的！现在它工作到这一点了！"

- **避免对特定框架，库或语言的偏见**
  虽然这本书专注于 Vue.js，但今天有无数优秀的框架，库和语言。
  事实上，除了 Vue.js 之外，我还有我的最爱，我经常从用它们构建的见解和服务中受益。
  这本书的目的纯粹是"理解 Vue.js"，不涉及对其他工具的排名或判断。

## 本在线书籍的主题和结构

由于这本书变得相当庞大，我设置了成就里程碑并将其分为不同的部分。

- **最小示例部分**
   在这里，Vue.js 以最基本的形式实现。
   虽然这一部分涵盖了最小的功能集，但它将处理
   虚拟 DOM，响应式系统，编译器和 SFC（单文件组件）支持。
   然而，这些实现远非实用，并且高度简化。
   不过，如果你只是想从整体上了解 Vue.js，这一部分已经足够。
   作为介绍性部分，这里的解释比其他部分更详细。
   完成本部分后，你在阅读 Vue.js 官方源码时应该会从容一些。在功能上，代码大致可以做到以下这些事情……

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

- **基础虚拟 DOM 部分**
  在这一部分中，我们将为虚拟 DOM 实现较为实用的 patch 渲染。虽然不会实现 [Suspense](https://vuejs.org/guide/built-ins/suspense) 等功能或更多优化，但它足以处理基本的渲染任务。我们还会在这里实现调度器。

- **基础响应式系统部分**
  虽然我们在最小示例部分实现了 reactive API，但在这一部分中我们将实现其他 API。从 ref，watch 和 computed 等基本 API 开始，我们还将深入研究 effectScope 和 shallow 系列等更高级的 API。

- **基础组件系统部分**
  在这里，我们将承担与组件系统相关的基本实现。事实上，由于我们已经在基础虚拟 DOM 部分为组件系统设置了基础，这里我们将专注于组件系统的其他方面。这包括 props/emit，provide/inject，响应式系统的扩展和生命周期钩子等功能。

- **基础模板编译器部分**
  除了在基础虚拟 DOM 部分实现的虚拟 DOM 系统编译器之外，我们将实现 v-on，v-bind 和 v-for 等指令。通常，这将涉及组件的 template 选项，我们不会在这里涵盖 SFC（单文件组件）。

- **基础 SFC 编译器部分**
  在这里，我们会基于“基础模板编译器”部分的成果，实现一个具备基本实用性的 SFC 编译器。
  具体来说，我们将实现 script setup 和编译器宏。
  在这一点上，体验将非常接近使用常规 Vue。

- **Web 应用程序要点部分**
  完成基础 SFC 编译器部分后，我们就拥有了一套基本可用的 Vue.js 功能。不过，要开发 Web 应用程序仍缺少不少能力，例如全局状态管理和路由。在这一部分中，我们将开发这些外围插件，让 chibivue 在 Web 应用开发中更加实用。

## 关于本书的意见和问题

我打算尽我所能回应关于这本书的问题和反馈。请随时在 Twitter 上联系我（通过 DM 或直接在时间线上）。由于我已经公开了存储库，您也可以在那里发布问题。我知道我自己的理解并不完美，所以我感谢任何反馈。如果您发现任何解释不清楚或具有挑战性，请不要犹豫询问。我的目标是向尽可能多的人传播清晰正确的解释，我希望我们能够一起构建这个。

https://x.com/ubugeeei

## 关于 Discord 服务器

我们为这本书创建了一个 Discord 服务器！（2024/01/01）
~~在这里，我们分享公告，为与这本在线书籍相关的问题和技巧提供支持。~~ \
我们也欢迎随意对话，所以让我们与其他 chibivue 用户愉快地交流。
目前，由于有很多日语使用者，大部分对话都是日语，但非日语使用者也欢迎毫不犹豫地加入！（完全可以使用您的母语）

最近，我们不仅积极为 chibivue 做贡献，还作为 Vue.js 日本社区服务器的一部分！

### 我们大致做什么

- 自我介绍（可选）
- 与 chibivue 相关的公告（如更新）
- 分享技巧
- 回答问题
- 响应请求
- 随意对话

### 如何加入

这是邀请链接: https://discord.gg/aVHvmbmSRy

您也可以从这本书标题右上角的 Discord 按钮加入。

## 关于作者

**ubugeeei (もののけ王)**

<img class="author-avatar" src="/figures/_people/ubugeeei-avatar.jpg" alt="ubugeeei" width="160" height="160">

[Vue.js](https://vuejs.org/about/team.html) Core Team 成员，[Vue.js Japan User Group](https://github.com/vuejs-jp) Core Staff，[Vite+](https://github.com/voidzero-dev/vite-plus) Core Contributor，[株式会社メイツ](https://github.com/mates-inc) Chief Engineer。\
[chibivue land](https://github.com/chibivue-land) King. https://chibivue.land

我在围绕 Vue，语言处理器和开发体验制作工具与书籍，主要包括 [chibivue](https://github.com/chibivue-land/chibivue)，[Vize](https://github.com/ubugeeei/vize)，[Ox Content](https://github.com/ubugeeei/ox-content)，[reading-vuejs-core-vapor](https://github.com/ubugeeei/reading-vuejs-core-vapor) 和 [Vapor Moon](https://github.com/ubugeeei/vapor-moon)。

https://wtrclred.io/

如果您愿意，请作为赞助商支持我！ https://github.com/sponsors/ubugeeei

## 赞助商

<div class="sponsors-block">
<a class="sponsors-image-link" href="https://github.com/sponsors/ubugeeei">
  <img class="sponsors-image sponsors-image--light" src="/figures/_sponsors/ubugeeei-sponsors.png" alt="ubugeeei's sponsors" />
  <img class="sponsors-image sponsors-image--dark" src="/figures/_sponsors/ubugeeei-sponsors-dark.png" alt="ubugeeei's sponsors" />
</a>

<p>如果您想支持我的工作，我将非常感激！</p>
<p><a href="https://github.com/sponsors/ubugeeei">https://github.com/sponsors/ubugeeei</a></p>

</div>
