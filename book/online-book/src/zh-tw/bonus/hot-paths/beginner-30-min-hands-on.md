# 初學者 30 分鐘動手實作

::: warning AI 產生的附錄
本附錄由 GPT-5.5 根據 chibivue 原書內容起草。請將這條路線視為學習指南；原始章節與實作程式碼仍是權威依據。
:::

這條路線協助你完成一個雖小卻完整的循環：建立應用程式、渲染按鈕、更新狀態，並理解為什麼需要編譯器。它延續了[15 分鐘編寫 Vue.js](/zh-tw/bonus/hyper-ultimate-super-extreme-minimal-vue/) 的精神，但保留了更充裕的理解時間。

## 目標

完成後，你應該能夠解釋下面這條鏈路：

```txt
createApp -> 渲染函式 -> VNode -> patch -> 響應式狀態 -> effect -> 重新渲染
```

你不需要理解每個邊界情況。目標是看清各個部分如何相互銜接。

## 0-5 分鐘：建立最小心智模型

閱讀：

- [chibivue，不是很小嗎……？](/zh-tw/bonus/hyper-ultimate-super-extreme-minimal-vue/)
- [專案設定](/zh-tw/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#專案設定-0-5-分鐘)

實作：

- 建立或開啟一個 chibivue playground 專案。
- 找到匯出這個微型 Vue 風格 API 的檔案，通常是 `packages/index.ts`。
- 記住一項原則：這條路線中的每項功能都可以刻意採用樸素實作。

檢查點：

- 即使所有程式碼都放在同一個檔案中，你也知道公開 API、渲染器、響應式系統和編譯器程式碼分別位於哪裡。

## 5-10 分鐘：createApp 與 h

閱讀：

- [createApp](/zh-tw/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#createapp-1-分鐘)
- [h 函式與虛擬 DOM](/zh-tw/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#h-函式和虛擬-dom-0-5-分鐘)
- 可選的深入章節：[首次渲染與 createApp API](/zh-tw/10-minimum-example/010-create-app-api)

實作：

- 編寫或查看一個接收 `setup` 和 `render` 的 `createApp` 函式。
- 編寫或查看一個回傳普通物件的 `h` 函式。
- 確保 VNode 只包含示範所需的資訊：標籤、事件和子節點。

檢查點：

- 你能說明 Vue 為什麼先渲染一個物件，而不是到處直接編寫 DOM 操作程式碼。

## 10-17 分鐘：將 VNode patch 到 DOM

閱讀：

- [patch 渲染](/zh-tw/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#補丁渲染-2-分鐘)
- 可選的深入章節：[最小虛擬 DOM](/zh-tw/10-minimum-example/040-minimum-virtual-dom)

實作：

- 將 VNode 轉換為實際的 DOM 元素。
- 綁定點擊事件處理器。
- 將元素插入 `mount` 所選擇的容器中。

檢查點：

- 渲染函式能夠產生 VNode，而 `patch` 能讓該 VNode 顯示在瀏覽器中。

## 17-23 分鐘：讓狀態具有響應性

閱讀：

- [實作](/zh-tw/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl)中的響應式部分
- 可選的深入章節：[嘗試實作一個小型響應式系統](/zh-tw/10-minimum-example/035-try-implementing-a-minimum-reactivity-system)

實作：

- 查看相依性儲存：哪個 effect 相依於哪個屬性？
- 在點擊事件處理器中更新狀態。
- 確認狀態變化時渲染 effect 會再次執行。

檢查點：

- 你可以把 `track` 解釋為「記住誰讀取了這個值」，把 `trigger` 解釋為「重新執行在意這個值的程式碼」。

## 23-28 分鐘：用模板取代手寫渲染函式

閱讀：

- [實作](/zh-tw/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl)中的編譯器與 SFC 部分
- 可選的深入章節：[理解模板編譯器](/zh-tw/10-minimum-example/060-template-compiler)、[解析 SFC](/zh-tw/10-minimum-example/091-parse-sfc)

實作：

- 查看一個小型模板如何變成渲染函式。
- 刻意限制編譯器的範圍：支援一個按鈕、一個事件和一次插值就足夠了。

檢查點：

- 你能說明編譯器並不是另一套神祕系統。它只是產生執行期已經知道如何執行的渲染函式。

## 28-30 分鐘：完成循環

口頭回答或記下以下問題：

- `h` 回傳什麼物件？
- 誰會呼叫 `patch`？
- 什麼會讓 `render` 再次執行？
- 為什麼這個微型實作需要 Vite 外掛才能支援 SFC？

下一條路線：

- 如果這次體驗不錯，請繼續[初學者 60 分鐘動手實作](./beginner-60-min-hands-on)。
- 如果程式碼顯得過於密集，請先慢慢閱讀[首次渲染與 createApp API](/zh-tw/10-minimum-example/010-create-app-api)，再繼續下一步。
