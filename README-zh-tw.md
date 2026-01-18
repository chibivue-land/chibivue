<p align="center">
  <img src="./book/online-book/src/public/logo.png" width="200">
</p>

<h1 align="center">chibivue</h1>

<p align="center">
  <b>編寫 Vue.js：從一行 "Hello, World" 開始，逐步構建。</b>
</p>

<p align="center">
  <a href="https://book.chibivue.land/zh-tw">線上書籍</a> ·
  <a href="https://discord.gg/aVHvmbmSRy">Discord</a> ·
  <a href="https://github.com/sponsors/ubugeeei">贊助</a>
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README-zh-cn.md">简体中文</a>
</p>

---

**chibivue** 是 [Vue.js](https://github.com/vuejs/core) 的最小化教學實現。

- 響應式系統
- 虛擬 DOM 和補丁渲染
- 組件系統
- 模板編譯器
- SFC 編譯器
- Vapor Mode（實驗性）

> "chibi" 在日語中意思是 "小"。

## 線上書籍

[![Pages Deploy](https://github.com/chibivue-land/chibivue/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/chibivue-land/chibivue/actions/workflows/deploy.yml)

| 語言 | 連結 |
|------|------|
| English | https://book.chibivue.land |
| 日本語 | https://book.chibivue.land/ja |
| 简体中文 | https://book.chibivue.land/zh-cn |
| 繁體中文 | https://book.chibivue.land/zh-tw |

## 快速開始

### 環境要求

- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/) v10+

### 本地閱讀書籍

```sh
git clone https://github.com/chibivue-land/chibivue
cd chibivue
pnpm install
pnpm dev
```

### 嘗試實現

```sh
pnpm setup      # 生成 playground
pnpm impl:dev   # 啟動開發伺服器
```

## 實現狀態

### 核心功能

| 分類 | 功能 | 狀態 |
|------|------|------|
| 響應式 | ref, reactive, computed, watch, effectScope | ✅ |
| 虛擬 DOM | h 函數, 補丁渲染, 調度器 | ✅ |
| 組件 | Options API, Composition API, 生命週期鉤子 | ✅ |
| 組件 | props, emit, provide/inject, 插槽 | ✅ |
| 模板 | v-bind, v-on, v-if, v-for, v-model | ✅ |
| SFC | template, script, style, script setup | ✅ |
| SFC | defineProps, defineEmits, scoped CSS | ✅ |
| 擴展 | Router, Store | ✅ |
| Vapor Mode | 基礎實現 | ✅ |
| SSR | 伺服器端渲染 | 🚧 |

## 附加章節

**超極限超極端最小 Vue**

僅用 **110 行**程式碼實現 createApp、虛擬 DOM、響應式、模板編譯器和 SFC 編譯器。

[閱讀章節](https://book.chibivue.land/zh-tw/bonus/hyper-ultimate-super-extreme-minimal-vue) · [查看原始碼](https://github.com/chibivue-land/chibivue/blob/main/book/impls/bonus/hyper-ultimate-super-extreme-minimal-vue/packages/index.ts)

## 貢獻

請查看 [contributing.md](.github/contributing.md)。

## 社群

加入我們的 [Discord 伺服器](https://discord.gg/aVHvmbmSRy) 參與討論、提問和獲取公告。

---

<div align="center">

## 贊助商

<a href="https://github.com/sponsors/ubugeeei">
  <img src="https://raw.githubusercontent.com/ubugeeei/sponsors/main/sponsors.png" alt="ubugeeei's sponsors" />
</a>

[成為贊助商](https://github.com/sponsors/ubugeeei)

</div>
