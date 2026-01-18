# 介绍

## 🎯 本书的目的

感谢您选择这本书！  
如果您对这本书哪怕有一点点兴趣，我都感到非常高兴．  
让我首先总结一下这本书的目的．

**☆ 目的**

- **深入理解 Vue.js**  
  什么是 Vue.js？它是如何构建的？
- **能够实现 Vue.js 的基本功能**  
  实际尝试实现基本功能．
- **阅读 vuejs/core 的源代码**  
  理解实现与官方代码之间的关系，掌握它们是如何真正构建的．

我提供了一个大致的目标概述，但没有必要完成所有目标，也不是要求追求完美．  
无论您是从头到尾阅读，还是只挑选感兴趣的部分，都由您决定．  
如果您发现这本书的哪怕一小部分有用，我都会很高兴！

## 🤷‍♂️ 目标读者

- **有 Vue.js 使用经验的人**
- **能够编写 TypeScript**

仅有这两个先决条件，不需要其他知识．  
虽然您在阅读本书过程中可能会遇到不熟悉的术语，但我已经尽力排除任何先验知识，并在过程中进行解释，旨在使这本书自成体系．  
但是，如果您遇到不应该用于 Vue.js 或 TypeScript 的术语，我建议您先从相应的资源中学习．  
（基本功能就足够了！（不需要深入研究））

## 🙋‍♀️ 本书（和作者）所关注的（并希望实现的）

在深入之前，我想分享一些我在写这本书时特别关注的事情．  
我希望您在阅读时记住这些，如果有任何我没有达到目标的地方，请告诉我．

- **消除对先验知识的需求**  
  虽然这可能与前面提到的"目标读者"部分重叠，但我努力使这本书尽可能自成体系，  
  最大限度地减少对先验知识的需求，并根据需要提供解释．  
  这是因为我想让尽可能多的读者理解尽可能清晰的解释．  
  有丰富经验的人可能会发现一些解释有点冗长，但我请求您的理解．

- **增量实现**  
  本书的目标之一是手工增量实现 Vue.js．这意味着本书专注于实践方法，  
  在实现方面，我强调以小的增量步骤构建．  
  更具体地说，就是"最小化非工作状态"．  
  而不是拥有直到完成才能工作的东西，目标是在每个阶段都保持其功能．  
  这反映了我个人的编码方法——持续编写非功能代码可能令人沮丧．  
  即使不完美，总是有东西在运行会使过程更愉快．  
  这是关于体验小胜利，比如"是的！现在它工作到这一点了！"

- **避免对特定框架，库或语言的偏见**  
  虽然这本书专注于 Vue.js，但今天有无数优秀的框架，库和语言．  
  事实上，除了 Vue.js 之外，我还有我的最爱，我经常从用它们构建的见解和服务中受益．  
  这本书的目的纯粹是"理解 Vue.js"，不涉及对其他工具的排名或判断．

## 💡 本在线书籍的主题和结构

由于这本书变得相当庞大，我设置了成就里程碑并将其分为不同的部分．

- **最小示例部分**  
   在这里，Vue.js 以最基本的形式实现．  
   虽然这一部分涵盖了最小的功能集，但它将处理  
   虚拟 DOM，响应式系统，编译器和 SFC（单文件组件）支持．  
   然而，这些实现远非实用，并且高度简化．  
   但是，对于那些想要 Vue.js 广泛概述的人来说，这一部分提供了足够的见解．  
   作为介绍性部分，这里的解释比其他部分更详细．  
   在本部分结束时，读者应该对阅读官方 Vue.js 源代码感到有些舒适．在功能上，您可以期望代码大致执行以下操作...

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
  在这一部分中，我们将为虚拟 DOM 实现相当实用的补丁渲染功能．虽然我们不会实现像 [Suspense](https://vuejs.org/guide/built-ins/suspense) 或其他优化等功能，但它将足够熟练地处理基本渲染任务．我们还将在这里实现调度器．

- **基础响应式系统部分**
  虽然我们在最小示例部分实现了 reactive API，但在这一部分中我们将实现其他 API．从 ref，watch 和 computed 等基本 API 开始，我们还将深入研究 effectScope 和 shallow 系列等更高级的 API．

- **基础组件系统部分**
  在这里，我们将承担与组件系统相关的基本实现．事实上，由于我们已经在基础虚拟 DOM 部分为组件系统设置了基础，这里我们将专注于组件系统的其他方面．这包括 props/emit，provide/inject，响应式系统的扩展和生命周期钩子等功能．

- **基础模板编译器部分**
  除了在基础虚拟 DOM 部分实现的虚拟 DOM 系统编译器之外，我们将实现 v-on，v-bind 和 v-for 等指令．通常，这将涉及组件的 template 选项，我们不会在这里涵盖 SFC（单文件组件）．

- **基础 SFC 编译器部分**
  在这里，我们将在利用基础模板编译器部分实现的模板编译器的同时，实现一个有些实用的 SFC 编译器．
  具体来说，我们将实现 script setup 和编译器宏．
  在这一点上，体验将非常接近使用常规 Vue．

- **Web 应用程序要点部分**
  当我们完成基础 SFC 编译器部分时，我们将拥有一套有些实用的 Vue.js 功能．然而，要开发 Web 应用程序，仍然缺少很多东西．例如，我们需要管理全局状态和路由器的工具．在这一部分中，我们将开发这样的外部插件，旨在从"Web 应用程序开发"的角度使我们的工具包更加实用．

## 🧑‍🏫 关于本书的意见和问题

我打算尽我所能回应关于这本书的问题和反馈．请随时在 Twitter 上联系我（通过 DM 或直接在时间线上）．由于我已经公开了存储库，您也可以在那里发布问题．我知道我自己的理解并不完美，所以我感谢任何反馈．如果您发现任何解释不清楚或具有挑战性，请不要犹豫询问．我的目标是向尽可能多的人传播清晰正确的解释，我希望我们能够一起构建这个 👍．

https://twitter.com/ubugeeei

## 🦀 关于 Discord 服务器

我们为这本书创建了一个 Discord 服务器！（2024/01/01）
~~在这里，我们分享公告，为与这本在线书籍相关的问题和技巧提供支持．~~ \
我们也欢迎随意对话，所以让我们与其他 chibivue 用户愉快地交流．
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

这是邀请链接 👉 https://discord.gg/aVHvmbmSRy

您也可以从这本书标题右上角的 Discord 按钮加入．

## 关于作者

**ubugeeei (もののけ王)**

<img src="/ubugeeei.jpg" alt="ubugeeei" width="200">

[Vue.js](https://github.com/vuejs) 成员，[Vue.js Japan User Group](https://github.com/vuejs-jp) 核心工作人员．\
[chibivue land](https://github.com/chibivue-land) King. 👉 https://chibivue.land

我还在开发 [vize](https://github.com/ubugeeei/vize)（Rust 制作的 Vue.js 工具链）和 [ox-content](https://github.com/ubugeeei/ox-content)（Rust 制作的文档工具链）。

https://wtrclred.io/

如果您愿意，请作为赞助商支持我！ 👉 https://github.com/sponsors/ubugeeei

<div align="center">

## 赞助商

<a href="https://github.com/sponsors/ubugeeei">
  <img src="https://raw.githubusercontent.com/ubugeeei/sponsors/main/sponsors.png" alt="ubugeeei's sponsors" />
</a>

如果您想支持我的工作，我将非常感激！

https://github.com/sponsors/ubugeeei

</div>
