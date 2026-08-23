# 進階 60 分鐘動手實作

::: warning AI 產生的附錄
本附錄由 GPT-5.5 根據 chibivue 原書內容起草。請將這條路線視為學習指南；原始章節與實作程式碼仍是權威依據。
:::

這條路線適合已熟悉 Vue、TypeScript 或框架內部機制的讀者。它不從首次渲染開始依原書順序閱讀，而是沿著更新路徑前進：狀態發生變化、工作進入排程佇列、元件重新渲染，編譯器輸出則為渲染器提供更精確的指令。

## 目標

完成後，你應該能夠追蹤下面這條路徑：

```txt
狀態變更 -> trigger -> 排程器 -> 元件更新 -> patch -> DOM 操作
```

你還應該知道編譯器轉換在這條執行期路徑中位於何處。

## 0-6 分鐘：選擇可執行的快照

閱讀：

- [稍作休息](/zh-tw/10-minimum-example/100-break)
- [基礎虛擬 DOM：key 屬性與 patch 渲染](/zh-tw/20-basic-virtual-dom/010-patch-keyed-children)

實作：

- 開啟 `book/impls/20_basic_virtual_dom/040_scheduler` 或更晚的實作快照。
- 找到 `renderer.ts`、`scheduler.ts`、`effect.ts` 和 `vnode.ts`。

檢查點：

- 你已經找到能解釋大多數執行期更新的四個檔案。

## 6-18 分鐘：渲染器與帶 key 的 patch

閱讀：

- [key 屬性與 patch 渲染](/zh-tw/20-basic-virtual-dom/010-patch-keyed-children)
- [VNode 的位元級表示](/zh-tw/20-basic-virtual-dom/020-bit-flags)
- [處理其他 Props 的 patch](/zh-tw/20-basic-virtual-dom/040-patch-other-attrs)

實作：

- 找到用來判斷 VNode 是元素還是元件的分支。
- 找到對子節點進行帶 key patch 的函式。
- 找到更新後 patch props 的位置。

檢查點：

- 你能說明 VNode 的哪些部分可以幫助渲染器選擇快速路徑。

## 18-30 分鐘：排程器與響應式

閱讀：

- [排程器](/zh-tw/20-basic-virtual-dom/030-scheduler)
- [響應式最佳化](/zh-tw/30-basic-reactivity-system/005-reactivity-optimization)
- [computed / watch API](/zh-tw/30-basic-reactivity-system/020-computed-watch)
- [Effect 清理與 Effect 作用域](/zh-tw/30-basic-reactivity-system/040-effect-scope)

實作：

- 找到 `trigger` 收集 effect 的位置。
- 找到元件更新進入佇列而不是立即執行的位置。
- 找到避免重複工作的地方。
- 查看 computed 或 watch 如何改變 effect 的執行時機。

檢查點：

- 你能區分「某個值發生了變化」和「DOM 已經更新」。排程器位於這兩個事件之間。

## 30-42 分鐘：元件更新介面

閱讀：

- [生命週期鉤子](/zh-tw/40-basic-component-system/010-lifecycle-hooks)
- [Provide/Inject](/zh-tw/40-basic-component-system/020-provide-inject)
- [元件代理與 setupContext](/zh-tw/40-basic-component-system/030-component-proxy-setup-context)
- [插槽](/zh-tw/40-basic-component-system/040-component-slot)

實作：

- 找到元件實例的資料結構。
- 找到 `setup` 的結果如何公開給渲染函式。
- 找到掛載或更新期間呼叫生命週期鉤子的位置。
- 找到插槽在渲染前被正規化的位置。

檢查點：

- 你可以把元件實例描述為執行期狀態、props、setup 狀態和渲染上下文的交會點。

## 42-56 分鐘：編譯器為執行期做準備

閱讀：

- [重構用於 Codegen 的 Transformer 實作](/zh-tw/50-basic-template-compiler/010-transform)
- [實作指令（v-bind）](/zh-tw/50-basic-template-compiler/020-v-bind)
- [在模板中求值運算式](/zh-tw/50-basic-template-compiler/022-transform-expression)
- [支援 v-on](/zh-tw/50-basic-template-compiler/025-v-on)
- [v-if 與結構指令](/zh-tw/50-basic-template-compiler/040-v-if-and-structural-directive)
- [支援 v-for](/zh-tw/50-basic-template-compiler/050-v-for)

實作：

- 追蹤一個指令如何從 AST 節點變成產生的渲染程式碼。
- 找到運算式被加上前綴，或依渲染上下文求值的位置。
- 比較 `v-if` 和 `v-for`：前者改變分支，後者改變列表形狀。

檢查點：

- 你能解釋編譯器轉換如何產生隨後由渲染器 patch 的 VNode 呼叫。

## 56-60 分鐘：選擇下一項深入學習內容

選擇一項：

- 偏重執行期：繼續閱讀[靜態提升](/zh-tw/90-web-application-essentials/040-optimizations/010-static-hoisting)、[Patch Flags](/zh-tw/90-web-application-essentials/040-optimizations/020-patch-flags)和[樹扁平化](/zh-tw/90-web-application-essentials/040-optimizations/030-tree-flattening)。
- 偏重編譯器：繼續閱讀[基礎 SFC 編譯器](/zh-tw/60-basic-sfc-compiler/010-script-setup)。
- 偏重生態系統：繼續閱讀[路由器](/zh-tw/90-web-application-essentials/010-plugins/010-router)、[Store](/zh-tw/90-web-application-essentials/010-plugins/020-store)和[語言工具](/zh-tw/90-web-application-essentials/010-plugins/040-language-tools)。\n
