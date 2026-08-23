# 高階 30 分鐘概要

::: warning AI 產生的附錄
本附錄由 GPT-5.5 根據 chibivue 原書內容起草。請將這條路線視為學習指南；原始章節與實作程式碼仍是權威依據。
:::

這是一幅高度壓縮的全書地圖，適合希望在閱讀原始碼前快速通覽全書的讀者。每個檢查點約用一分鐘。內容已經很清楚時就繼續前進；感覺模糊時則開啟連結所指的章節。

## 30 個檢查點

1. [全書從一行渲染程式碼開始](/zh-tw/00-introduction/010-about)：重點不是完美複製 Vue，而是親手重建其中的概念。
2. [Vue 的核心組成部分](/zh-tw/00-introduction/030-vue-core-components)：執行期、渲染器、響應式系統、編譯器和 SFC 工具分別關注不同的問題。
3. [專案設定](/zh-tw/00-introduction/040-setup-project)：套件邊界讓學習路徑清晰可見。
4. [createApp](/zh-tw/10-minimum-example/010-create-app-api)：應用程式 API 封裝掛載過程，為使用者提供統一入口。
5. [套件架構](/zh-tw/10-minimum-example/015-package-architecture)：runtime-core 保持平台無關，runtime-dom 負責瀏覽器操作。
6. [h 與 VNode](/zh-tw/10-minimum-example/020-simple-h-function)：渲染結果是資料結構，而不是 DOM。
7. [事件與屬性](/zh-tw/10-minimum-example/025-event-handler-and-attrs)：DOM patch 需要針對平台處理 props。
8. [最小響應式系統](/zh-tw/10-minimum-example/035-try-implementing-a-minimum-reactivity-system)：Proxy 讀取意味著 track，Proxy 寫入意味著 trigger。
9. [最小虛擬 DOM](/zh-tw/10-minimum-example/040-minimum-virtual-dom)：patch 比較新舊 VNode 並更新 DOM。
10. [最小元件](/zh-tw/10-minimum-example/050-minimum-component)：掛載元件 VNode 時會建立實例並執行渲染函式。
11. [Props](/zh-tw/10-minimum-example/051-component-props)：父元件的資料透過正規化輸入傳入子元件。
12. [Emits](/zh-tw/10-minimum-example/052-component-emits)：子元件事件本質上是依慣例命名的父元件處理器。
13. [模板編譯器概覽](/zh-tw/10-minimum-example/060-template-compiler)：模板會變成渲染函式。
14. [編譯器實作](/zh-tw/10-minimum-example/061-template-compiler-impl)：解析、轉換和程式碼產生構成編譯器的核心流程。
15. [模板綁定](/zh-tw/10-minimum-example/080-template-binding)：編譯器輸出必須從渲染上下文讀取值。
16. [解析 SFC](/zh-tw/10-minimum-example/091-parse-sfc)：`.vue` 檔案會拆分為 script、template 和 style 區塊。
17. [SFC template/script/style](/zh-tw/10-minimum-example/092-compile-sfc-template)：Vite 外掛將 SFC 轉換接入開發流程。
18. [帶 key 的 patch](/zh-tw/20-basic-virtual-dom/010-patch-keyed-children)：穩定的 key 讓渲染器能夠移動和重複使用子節點。
19. [Shape Flags](/zh-tw/20-basic-virtual-dom/020-bit-flags)：位元旗標降低重複型別檢查的成本。
20. [排程器](/zh-tw/20-basic-virtual-dom/030-scheduler)：響應式變化將工作加入佇列，從而批次處理重複更新。
21. [ref、computed 與 watch](/zh-tw/30-basic-reactivity-system/010-ref-api)：響應式能力從物件擴充到值容器和面向使用者的 effect。
22. [響應式 Proxy 處理器](/zh-tw/30-basic-reactivity-system/030-reactive-proxy-handlers)：集合、ref、唯讀值與 shallow 值需要更細緻的處理器邏輯。
23. [Effect 清理與作用域](/zh-tw/30-basic-reactivity-system/040-effect-scope)：effect 不只需要重新執行，也需要生命週期管理。
24. [元件生命週期](/zh-tw/40-basic-component-system/010-lifecycle-hooks)：元件實例為執行期呼叫使用者鉤子提供時機。
25. [Provide/Inject 與 setup context](/zh-tw/40-basic-component-system/020-provide-inject)：元件樹需要結構化的相依性與上下文傳遞管道。
26. [插槽](/zh-tw/40-basic-component-system/040-component-slot)：子節點可以作為延遲執行的渲染函式傳遞。
27. [模板轉換](/zh-tw/50-basic-template-compiler/010-transform)：指令是將語法轉換為 VNode 資料的編譯器外掛。
28. [結構指令](/zh-tw/50-basic-template-compiler/040-v-if-and-structural-directive)：`v-if`、`v-for`、Fragment、註解和插槽共同決定產生樹的形狀。
29. [SFC 編譯器巨集](/zh-tw/60-basic-sfc-compiler/010-script-setup)：`script setup`、`defineProps`、`defineEmits`、scoped CSS 和基於型別的巨集都是編譯期便利功能。
30. [應用程式開發基礎與最佳化](/zh-tw/90-web-application-essentials/010-plugins/010-router)：路由、Store、SSR、內建元件、靜態提升、Patch Flags、樹扁平化和 Vapor Mode 展示同一組核心概念如何擴充。

## 完成概要之後

不中斷地閱讀一條原始碼路徑：

```txt
packages/reactivity -> packages/runtime-core -> packages/runtime-dom -> packages/compiler-core -> packages/compiler-sfc
```

接著閱讀[除錯原始 Vue.js 原始碼](/zh-tw/bonus/debug-vuejs-core)，將 chibivue 的簡化選擇與 `vuejs/core` 比較。\n
