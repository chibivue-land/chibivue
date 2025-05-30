<p align="center">
  <img src="./book/images/logo/chibivue-img.png" width="600">
</p>

<div align="center">

### [**編寫 Vue.js：從一行 "Hello, World" 開始，逐步構建。**](https://book.chibivue.land)

https://book.chibivue.land

</div>

---

chibivue 是 [vuejs/core](https://github.com/vuejs/core) 的最小化實現。  
（響應式系統、虛擬 DOM 和補丁渲染、組件系統、模板編譯器、SFC 編譯器）

"`chibi`" 在日語中意思是 "`小`"。

這個項目始於 2023 年 2 月，目標是簡化對 Vue 核心實現的理解。

目前，我仍在實現過程中，但在實現之後，我打算發布解釋性文章。

（現在，我計劃先發布日語版本。）

[示例](https://github.com/chibivue-land/chibivue/tree/main/examples/app)

# 👜 套件管理器

這個項目使用 [pnpm](https://pnpm.io/) 作為套件管理器。

並使用 [ni](https://github.com/antfu/ni)。

```sh
# 如果你還沒有 ni
npm i -g @antfu/ni
```

# 📔 線上書籍

[![Pages Deploy](https://github.com/chibivue-land/chibivue/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/chibivue-land/chibivue/actions/workflows/deploy.yml)

> 總計：370,000 字符 ↑ （日語）

### 書籍網址（GitHub Pages）

英語：https://book.chibivue.land/

日語：https://book.chibivue.land/ja

簡體中文：https://book.chibivue.land/zh-cn

繁體中文：https://book.chibivue.land/zh-tw

### 在本地打開書籍

```sh
$ git clone https://github.com/chibivue-land/chibivue
$ cd chibivue
$ ni
$ nr book:dev
```

### 在 GitHub 上查看

[英語](https://github.com/chibivue-land/chibivue/tree/main/book/online-book/src) | [日語](https://github.com/chibivue-land/chibivue/tree/main/book/online-book/src/ja) | [簡體中文](https://github.com/chibivue-land/chibivue/tree/main/book/online-book/src/zh-cn) | [繁體中文](https://github.com/chibivue-land/chibivue/tree/main/book/online-book/src/zh-tw)
<br/>
<br/>

# 🎥 遊樂場

```sh
$ git clone https://github.com/chibivue-land/chibivue
$ cd chibivue
$ ni

# 生成遊樂場文件到 ~/example/playground（git 忽略）
$ nr setup:dev

# 監聽本地主機
$ nr dev
```

# ⚠️ 狀態

這本線上書籍目前正在進行中。

請參考以下資訊了解進度狀態。

### 響應式系統

| 功能            | 實現 | 書籍 |
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

### 虛擬 DOM 和渲染器

| 功能            | 實現 | 書籍 |
| --------------- | ---- | ---- |
| h function      | ✅   | ✅   |
| patch rendering | ✅   | ✅   |
| key attribute   | ✅   | ✅   |
| scheduler       | ✅   | ✅   |
| nextTick        | ✅   | ✅   |
| ssr             |      |      |

### 組件系統

| 功能                             | 實現 | 書籍 |
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

### 模板編譯器

| 功能               | 實現 | 書籍 |
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

### SFC 編譯器

| 功能                                 | 實現 | 書籍 |
| ------------------------------------ | ---- | ---- |
| basics (template, script, style)    | ✅   | ✅   |
| scoped css                           |      |      |
| script setup                         | ✅   |      |
| compiler macro                       | ✅   |      |

### 擴展和其他內建功能

| 功能       | 實現 | 書籍 |
| ---------- | ---- | ---- |
| store      | ✅   |      |
| router     | ✅   |      |
| keep-alive |      |      |
| suspense   |      |      |

# 🗓️ 重大計劃

- 完成基礎模板編譯器
  - 插槽
- 完成基礎 SFC 編譯器
  - script setup
  - 編譯器宏
- 整體重構
  - 修復拼寫錯誤和錯誤
  - 審查文本的英語版本
  - 使解釋更易理解
- SSR / SSG 的實現和解釋
- 編譯時優化的實現和解釋
  樹扁平化和靜態提升等
- 整合可能包含在 Vue.js 3.4 中的解析器重構
　https://github.com/vuejs/core/pull/9674
- 整合可能包含在 Vue.js 3.4 中的響應式套件重構
  https://github.com/vuejs/core/pull/5912
- 🌟 **Vapor Mode** 的實現和解釋
  由於官方版本尚未發布，我們將基於我們的預測來實現它。
  https://github.com/vuejs/core-vapor/tree/main

# 🎉 獎勵曲目

這是關於在 15 分鐘內編寫 Vue.js 的獎勵曲目，因為 chibivue 變得太大了。

本章在僅 110 行源代碼中實現了 createApp / 虛擬 dom / patch / 響應式 / 模板編譯器 / sfc 編譯器。

標題是 "**超極限超極端最小 Vue - 15 分鐘編寫 Vue.js**"

[線上書籍](https://book.chibivue.land/bonus/hyper-ultimate-super-extreme-minimal-vue) | [實際源碼](https://github.com/chibivue-land/chibivue/blob/main/book/impls/bonus/hyper-ultimate-super-extreme-minimal-vue/packages/index.ts)

<img src="./book/images/hyper-ultimate-super-extreme-minimal-vue.png">

# 貢獻

請查看 [contributing.md](https://github.com/chibivue-land/chibivue/blob/main/.github/contributing.md)。


<div align="center">

# 贊助商

<a href="https://github.com/sponsors/ubugeeei">
  <img src="https://raw.githubusercontent.com/ubugeeei/sponsors/main/sponsors.png" alt="ubugeeei's sponsors" />
</a>

如果您想支持我的工作，我將非常感激！

https://github.com/sponsors/ubugeeei

</div>

</div>
