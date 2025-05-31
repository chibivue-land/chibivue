# 除錯原始原始碼

有時您可能想要執行和測試 Vue.js 的實際原始碼。  
作為本書方法的一部分，我們強烈建議閱讀和理解原始原始碼，以及進行原始碼閱讀和測試實驗。

因此，我們將介紹幾種除錯原始原始碼的方法，這些方法在正文中沒有涉及。

（我們將按照易於理解的順序介紹它們。）

## 利用 SFC Playground

這是最簡單的方法。它廣為人知，甚至在官方文件中也有連結。

https://play.vuejs.org

在這個 playground 中，您不僅可以編寫 Vue 組件並檢查它們的行為，還可以檢查 SFC 的編譯結果。  
它很方便，因為您可以在瀏覽器中快速檢查它。（當然，您也可以分享它。）

<video src="https://github.com/ubugeeei/ubugeeei/assets/71201308/8281e589-fdaf-4206-854e-25a66dfaac05" controls />

## 利用 vuejs/core 測試

接下來，讓我們嘗試執行 [vuejs/core](https://github.com/vuejs/core) 的測試。
當然，您需要複製 [vuejs/core](https://github.com/vuejs/core) 的原始碼。

```bash
git clone https://github.com/vuejs/core.git vuejs-core
# NOTE: 建議使其易於理解，因為儲存庫名稱是 `core`
```

然後，

```bash
cd vuejs-core
ni
nr test
```

您可以執行測試，所以請隨意修改您感興趣的原始碼並執行測試。

除了 `test` 之外還有幾個其他的測試指令，如果您感興趣，請檢查 `package.json`。

您可以閱讀和理解測試程式碼，修改程式碼並執行測試，或新增測試案例。有各種使用方法。

<img width="590" alt="Screenshot 2024-01-07 0 31 29" src="https://github.com/ubugeeei/ubugeeei/assets/71201308/3c862bd5-1d94-4d2a-a9fa-8755872098ed">

## 執行 vuejs/core 原始碼

接下來，這是最方便但仍然是實際修改和執行 vuejs/core 原始碼的方法。

關於這一點，我們已經準備了可以與 vite 進行 HMR 的專案，包括 SFC 和獨立版本，所以請嘗試使用它們。
這個專案在 [chibivue](https://github.com/chibivue-land/chibivue) 的儲存庫中，所以請複製它。

```bash
git clone https://github.com/chibivue-land/chibivue.git
```

複製後，執行腳本來建立專案。

此時，您應該被要求輸入本地 vuejs/core 原始碼的**絕對路徑**，所以請輸入它。

```bash
cd chibi-vue
ni
nr setup:vue

# 💁 input your local vuejs/core absolute path:
#   e.g. /Users/ubugeeei/oss/vuejs-core
#   >
```

這將在 chibivue 儲存庫中建立一個指向本地 vuejs/core 原始碼的 Vue 專案。

<video src="https://github.com/ubugeeei/work-log/assets/71201308/5d57c022-c411-4452-9e7e-c27623ec28b4" controls/>

然後，當您想要啟動時，您可以使用以下指令啟動它，並在修改 vuejs/core 原始碼的同時檢查操作。

```bash
nr dev:vue
```

當然，playground 端的 HMR，

<video src="https://github.com/ubugeeei/work-log/assets/71201308/a2ad46d8-4b07-4ac5-a887-f71507c619a6" controls/>

即使您修改 vuejs/core 程式碼，HMR 也會工作。

<video src="https://github.com/ubugeeei/work-log/assets/71201308/72f38910-19b8-4171-9ed7-74d1ba223bc8" controls/>

---

另外，如果您想在獨立模式下檢查它，您也可以透過將 index.html 更改為載入 standalone-vue.js 來使用 HMR。

<video src="https://github.com/ubugeeei/work-log/assets/71201308/c57ab5c2-0e62-4971-b1b4-75670d3efeec" controls/>
