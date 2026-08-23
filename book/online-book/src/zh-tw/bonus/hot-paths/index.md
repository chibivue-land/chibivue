# 快速學習路線

::: warning AI 產生的附錄
本附錄由 GPT-5.5 根據 chibivue 原書內容起草。請將這些路線視為學習指南；原始章節與實作程式碼仍是權威依據。
:::

chibivue 刻意採用漸進式講解，但這也使全書篇幅較長。本附錄提供幾條較短的閱讀路線，適合在依序通讀全書前先掌握核心概念。

每條路線都會說明要閱讀什麼、實作或查看什麼，以及在哪裡結束。如果某條路線節奏太快，可以跳到連結所指的原始章節，弄懂缺少的環節後再回來。

## 路線

| 路線 | 所需時間 | 適合讀者 | 你將理解 |
| --- | --- | --- | --- |
| [初學者 30 分鐘動手實作](./beginner-30-min-hands-on) | 30 分鐘 | 希望以最小成果入門的首次閱讀者 | `createApp`、VNode 渲染、響應式與微型編譯器如何銜接 |
| [初學者 60 分鐘動手實作](./beginner-60-min-hands-on) | 60 分鐘 | 能安排一段完整時間學習的初學者 | 從首次渲染到 SFC 的完整 Minimum Example 流程 |
| [進階 60 分鐘動手實作](./intermediate-60-min-hands-on) | 60 分鐘 | 已熟悉 Vue 或 TypeScript 的讀者 | 使元件更新得以運作的執行期和編譯器路徑 |
| [高階 30 分鐘概要](./advanced-30-min-summary) | 30 分鐘 | 希望在閱讀原始碼前先取得精簡全貌的讀者 | 以 30 個檢查點串起全書內容 |

## 如何使用這些路線

1. 閱讀路線時，在旁邊同時開啟對應的原始章節。
2. 為每一節設定時間上限。保持整體認識比完成整條路線更重要。
3. 想將自己的理解與可執行程式碼對照時，請查看 `book/impls` 下的實作快照。
4. 完成一條路線後，選一篇原始章節慢慢精讀。快速路線只是地圖，不是知識本身。

## 涵蓋的原書部分

- [入門指南](/zh-tw/00-introduction/010-about)
- [最小範例](/zh-tw/10-minimum-example/010-create-app-api)
- [基礎虛擬 DOM](/zh-tw/20-basic-virtual-dom/010-patch-keyed-children)
- [基礎響應式系統](/zh-tw/30-basic-reactivity-system/005-reactivity-optimization)
- [基礎元件系統](/zh-tw/40-basic-component-system/010-lifecycle-hooks)
- [基礎模板編譯器](/zh-tw/50-basic-template-compiler/010-transform)
- [基礎 SFC 編譯器](/zh-tw/60-basic-sfc-compiler/010-script-setup)
- [Web 應用程式開發基礎](/zh-tw/90-web-application-essentials/010-plugins/010-router)
- [15 分鐘編寫 Vue.js](/zh-tw/bonus/hyper-ultimate-super-extreme-minimal-vue/)\n
