<p align="center">
  <img src="./book/online-book/src/public/og.png" width="600">
</p>

<div align="center">

### [**编写 Vue.js：从一行 "Hello, World" 开始，逐步构建。**](https://book.chibivue.land)

https://book.chibivue.land

</div>

---

chibivue 是 [vuejs/core](https://github.com/vuejs/core) 的最小化实现。  
（响应式系统、虚拟 DOM 和补丁渲染、组件系统、模板编译器、SFC 编译器）

"`chibi`" 在日语中意思是 "`小`"。

这个项目始于 2023 年 2 月，目标是简化对 Vue 核心实现的理解。

目前，我仍在实现过程中，但在实现之后，我打算发布解释性文章。

（现在，我计划先发布日语版本。）

[示例](https://github.com/chibivue-land/chibivue/tree/main/examples/app)

# 👜 环境要求

- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/) v10+
- [@antfu/ni](https://github.com/antfu/ni)

```sh
# 如果你还没有 ni
npm i -g @antfu/ni
```

# 📔 在线书籍

[![Pages Deploy](https://github.com/chibivue-land/chibivue/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/chibivue-land/chibivue/actions/workflows/deploy.yml)

> 总计：370,000 字符 ↑ （日语）

### 书籍网址（GitHub Pages）

英语：https://book.chibivue.land/

日语：https://book.chibivue.land/ja

简体中文：https://book.chibivue.land/zh-cn

繁体中文：https://book.chibivue.land/zh-tw

### 在本地打开书籍

```sh
$ git clone https://github.com/chibivue-land/chibivue
$ cd chibivue
$ ni
$ nr book:dev
```

### 在 GitHub 上查看

[英语](https://github.com/chibivue-land/chibivue/tree/main/book/online-book/src) | [日语](https://github.com/chibivue-land/chibivue/tree/main/book/online-book/src/ja) | [简体中文](https://github.com/chibivue-land/chibivue/tree/main/book/online-book/src/zh-cn) | [繁体中文](https://github.com/chibivue-land/chibivue/tree/main/book/online-book/src/zh-tw)
<br/>
<br/>

# 🎥 游乐场

```sh
$ git clone https://github.com/chibivue-land/chibivue
$ cd chibivue

# 安装依赖并生成游乐场
$ nr setup

# 启动开发服务器
$ nr dev
```

# ⚠️ 状态

这本在线书籍目前正在进行中。

请参考以下信息了解进度状态。

### 响应式系统

| 功能            | 实现 | 书籍 |
| --------------- | ---- | ---- |
| ref             | ✅   | ✅   |
| computed        | ✅   | ✅   |
| reactive        | ✅   | ✅   |
| readonly        | ✅   | ✅   |
| watch           | ✅   | ✅   |
| watchEffect     | ✅   | ✅   |
| isRef           | ✅   | ✅   |
| unref           | ✅   | ✅   |
| toRef           | ✅   | ✅   |
| toRefs          | ✅   | ✅   |
| isProxy         | ✅   | ✅   |
| isReactive      | ✅   | ✅   |
| isReadonly      | ✅   | ✅   |
| shallowRef      | ✅   | ✅   |
| triggerRef      | ✅   | ✅   |
| shallowReactive | ✅   | ✅   |
| customRef       | ✅   | ✅   |
| toRaw           | ✅   | ✅   |
| effectScope     | ✅   | ✅   |
| getCurrentScope | ✅   | ✅   |
| onScopeDispose  | ✅   | ✅   |
| template refs   | ✅   | ✅   |

### 虚拟 DOM 和渲染器

| 功能            | 实现 | 书籍 |
| --------------- | ---- | ---- |
| h function      | ✅   | ✅   |
| patch rendering | ✅   | ✅   |
| key attribute   | ✅   | ✅   |
| scheduler       | ✅   | ✅   |
| nextTick        | ✅   | ✅   |
| ssr             |      |      |

### 组件系统

| 功能                             | 实现 | 书籍 |
| -------------------------------- | ---- | ---- |
| Options API (typed)              | ✅   | ✅   |
| Composition API                  | ✅   | ✅   |
| lifecycle hooks                  | ✅   | ✅   |
| props / emit                     | ✅   | ✅   |
| expose                           | ✅   | ✅   |
| provide / inject                 | ✅   | ✅   |
| slot (default)                   | ✅   | ✅   |
| slot (named/scoped)              | ✅   | ✅   |
| async component and suspense     |      |      |

### 模板编译器

| 功能               | 实现 | 书籍 |
| ------------------ | ---- | ---- |
| v-bind             | ✅   | ✅   |
| v-on               | ✅   | ✅   |
| event modifier     | ✅   | ✅   |
| v-if               | ✅   | ✅   |
| v-for              | ✅   | ✅   |
| v-model            | ✅   |      |
| v-show             |      |      |
| mustache           | ✅   | ✅   |
| slot (default)     |      |      |
| slot (named)       |      |      |
| slot (scoped)      |      |      |
| dynamic component  |      |      |
| comment out        | ✅   | ✅   |
| fragment           | ✅   | ✅   |
| bind expressions   | ✅   | ✅   |
| resolve components | ✅   | ✅   |

### SFC 编译器

| 功能                                 | 实现 | 书籍 |
| ------------------------------------ | ---- | ---- |
| basics (template, script, style)    | ✅   | ✅   |
| scoped css                           |      |      |
| script setup                         | ✅   |      |
| compiler macro                       | ✅   |      |

### 扩展和其他内置功能

| 功能       | 实现 | 书籍 |
| ---------- | ---- | ---- |
| store      | ✅   |      |
| router     | ✅   |      |
| keep-alive |      |      |
| suspense   |      |      |

# 🗓️ 重大计划

- 完成基础模板编译器
  - 插槽
- 完成基础 SFC 编译器
  - script setup
  - 编译器宏
- 整体重构
  - 修复拼写错误和错误
  - 审查文本的英语版本
  - 使解释更易理解
- SSR / SSG 的实现和解释
- 编译时优化的实现和解释
  树扁平化和静态提升等
- 整合可能包含在 Vue.js 3.4 中的解析器重构
　https://github.com/vuejs/core/pull/9674
- 整合可能包含在 Vue.js 3.4 中的响应式包重构
  https://github.com/vuejs/core/pull/5912
- 🌟 **Vapor Mode** 的实现和解释
  由于官方版本尚未发布，我们将基于我们的预测来实现它。
  https://github.com/vuejs/core-vapor/tree/main

# 🎉 奖励曲目

这是关于在 15 分钟内编写 Vue.js 的奖励曲目，因为 chibivue 变得太大了。

本章在仅 110 行源代码中实现了 createApp / 虚拟 dom / patch / 响应式 / 模板编译器 / sfc 编译器。

标题是 "**超极限超极端最小 Vue - 15 分钟编写 Vue.js**"

[在线书籍](https://book.chibivue.land/bonus/hyper-ultimate-super-extreme-minimal-vue) | [实际源码](https://github.com/chibivue-land/chibivue/blob/main/book/impls/bonus/hyper-ultimate-super-extreme-minimal-vue/packages/index.ts)

<img src="./book/images/hyper-ultimate-super-extreme-minimal-vue.png">

# 贡献

请查看 [contributing.md](https://github.com/chibivue-land/chibivue/blob/main/.github/contributing.md)。


<div align="center">

# 赞助商

<a href="https://github.com/sponsors/ubugeeei">
  <img src="https://raw.githubusercontent.com/ubugeeei/sponsors/main/sponsors.png" alt="ubugeeei's sponsors" />
</a>

如果您想支持我的工作，我将非常感激！

https://github.com/sponsors/ubugeeei

</div>

</div>
