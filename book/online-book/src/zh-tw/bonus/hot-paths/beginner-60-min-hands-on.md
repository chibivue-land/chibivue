# 初學者 60 分鐘動手實作

::: warning AI 產生的附錄
本附錄由 GPT-5.5 根據 chibivue 原書內容起草。請將這條路線視為學習指南；原始章節與實作程式碼仍是權威依據。
:::

這條路線帶你走過原書的 Minimum Example，但不要求吸收每一處講解。你將接觸一個 Vue 風格框架的主要輪廓：應用程式 API、渲染器、響應式系統、元件、模板編譯器以及 SFC 支援。

## 目標

完成後，你應該理解 chibivue 為什麼要拆分為多個套件，以及一個 `.vue` 檔案最終如何轉化為 DOM 更新。

## 0-8 分鐘：專案結構

閱讀：

- [本書的學習方式與環境建置](/zh-tw/00-introduction/040-setup-project)
- [套件架構](/zh-tw/10-minimum-example/015-package-architecture)

實作：

- 在 `book/impls` 下的實作快照中找到 `packages/runtime-core`、`packages/runtime-dom`、`packages/reactivity`、`packages/compiler-core`、`packages/compiler-dom` 和 `packages/compiler-sfc`。
- 用一句話寫下每個套件負責解決的問題。

檢查點：

- 你能區分執行期程式碼和編譯器程式碼。

## 8-18 分鐘：首次渲染

閱讀：

- [首次渲染與 createApp API](/zh-tw/10-minimum-example/010-create-app-api)
- [讓我們支援渲染 HTML 元素](/zh-tw/10-minimum-example/020-simple-h-function)
- [支援事件處理器與屬性](/zh-tw/10-minimum-example/025-event-handler-and-attrs)

實作：

- 追蹤 `createApp(...).mount(...)` 如何到達渲染器。
- 找到建立元素的位置。
- 找到套用 props 或事件處理器的位置。

檢查點：

- 你能追蹤一個按鈕如何從渲染函式變成真實 DOM。

## 18-28 分鐘：初識響應式

閱讀：

- [響應式系統的前置知識](/zh-tw/10-minimum-example/030-prerequisite-knowledge-for-the-reactivity-system)
- [嘗試實作一個小型響應式系統](/zh-tw/10-minimum-example/035-try-implementing-a-minimum-reactivity-system)

實作：

- 找到儲存目前 active effect 的位置。
- 找到追蹤屬性讀取的位置。
- 找到屬性寫入觸發 effect 的位置。

檢查點：

- 你理解響應式狀態為什麼同時需要 Proxy 和 effect 函式。

## 28-40 分鐘：VNode 與元件

閱讀：

- [最小虛擬 DOM](/zh-tw/10-minimum-example/040-minimum-virtual-dom)
- [邁向以元件為導向的開發](/zh-tw/10-minimum-example/050-minimum-component)
- [元件 Props](/zh-tw/10-minimum-example/051-component-props)
- [元件 Emit](/zh-tw/10-minimum-example/052-component-emits)

實作：

- 比較元素 VNode 與元件 VNode。
- 找到呼叫元件 `setup` 的位置。
- 找到 props 如何進入元件，以及 emit 如何從元件向外傳遞。

檢查點：

- 你能解釋為什麼元件也表示為 VNode。

## 40-52 分鐘：模板編譯器

閱讀：

- [理解模板編譯器](/zh-tw/10-minimum-example/060-template-compiler)
- [實作模板編譯器](/zh-tw/10-minimum-example/061-template-compiler-impl)
- [資料綁定](/zh-tw/10-minimum-example/080-template-binding)

實作：

- 追蹤這條流程：模板字串、解析結果、產生的渲染函式。
- 找到 `{{ count }}` 這類插值被轉換為程式碼的位置。

檢查點：

- 你能說明編譯器會產生什麼，以及執行期為什麼能執行它。

## 52-60 分鐘：SFC 支援

閱讀：

- [使用 SFC 開發（相關知識）](/zh-tw/10-minimum-example/090-prerequisite-knowledge-for-the-sfc)
- [解析 SFC](/zh-tw/10-minimum-example/091-parse-sfc)
- [SFC template 區塊](/zh-tw/10-minimum-example/092-compile-sfc-template)
- [SFC script 區塊](/zh-tw/10-minimum-example/093-compile-sfc-script)
- [SFC style 區塊](/zh-tw/10-minimum-example/094-compile-sfc-style)

實作：

- 找出 SFC 的三個區塊。
- 找到哪個區塊會變成渲染程式碼。
- 找到哪個區塊會變成元件選項。
- 找到哪個區塊會變成 CSS。

檢查點：

- 你可以把 `.vue` 描述為一種便於編寫的格式；執行期看到它之前，它會被拆分和轉換。

## 到此為止

現在你已經掌握了整體骨架。接下來最好不要急著學習所有高階功能，而是選出最令你意外的部分，重新完整閱讀對應的原始章節。
