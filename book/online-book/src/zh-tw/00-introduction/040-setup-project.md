# 如何進行本書學習和環境設定

## Web Playground

本書提供了一個 **Web Playground**，您可以直接在瀏覽器中試用每個章節的實作程式碼。
無需任何環境設定，您可以立即編輯和執行程式碼，所以請先在這裡體驗 chibivue 的實際執行！

### 如何啟動 Playground

```sh
$ git clone https://github.com/chibivue-land/chibivue
$ cd chibivue
$ vp install
$ vp run play
```

執行這些命令需要 [Vite+](https://viteplus.dev/guide/)（`vp`）。

在瀏覽器中開啟顯示的 URL（例如：`http://localhost:5173/`）即可使用 Playground。

### Playground 佈局

![Initial Web Playground screen](/figures/00-introduction/setup-project/web-playground-initial.png)

Playground 由四個區域組成：

| 區域 | 說明 |
|------|------|
| **Explorer（左側）** | 顯示專案檔案樹。點擊檔案可在編輯器中打開 |
| **Editor（中央）** | 使用 Monaco Editor 編輯程式碼 |
| **Preview（右側）** | 顯示在 WebContainer 上執行的開發伺服器預覽 |
| **Terminal / Console（底部）** | 查看終端輸出和 console.log 內容 |

### 使用方法

1. **選擇章節**
   從螢幕頂部的下拉選單中選擇您想學習的章節。
   您也可以使用搜尋框過濾章節名稱。

2. **點擊 Run**
   點擊「Run」按鈕啟動 WebContainer，安裝相依並啟動開發伺服器。
   首次執行需要一些時間，稍等片刻後，結果將顯示在 Preview 區域。

3. **編輯程式碼**
   在編輯器中編輯程式碼，然後點擊「Apply」按鈕應用更改。
   透過 HMR（熱模組替換），更改會即時反映。

4. **查看主控台**
   點擊「Console」標籤頁查看 console.log 等輸出內容。

![Web Playground console output](/figures/00-introduction/setup-project/web-playground-console.png)

::: tip
Web Playground 使用 [WebContainer](https://webcontainers.io/)。
在某些瀏覽器或環境中可能無法執行。在這種情況下，請參考下面的本地環境設定。
:::

## 如何進行本書學習

我們將立即開始 Vue.js 的簡單實作。以下是一些需要記住的要點，注意事項和其他重要資訊：

- 專案名稱將是「chibivue」。我們將把本書中涵蓋的基本 Vue.js 實作稱為「chibivue」。
- 如最初提到的，我們的主要方法將是「重複小型開發」。
- 每個階段的原始碼都包含在本書的附錄中，可以在 https://github.com/chibivue-land/chibivue/tree/main/book/impls 找到。我們不會在書中為所有原始碼提供詳細解釋，所以請根據需要參考附錄。
- 最終程式碼相依於幾個套件。DIY 內容的一個常見問題是關於「應該手工實作多少才能稱之為自製」的爭論。雖然我們不會在本書中手工編寫所有原始碼，但我們將積極使用與 Vue.js 官方程式碼中使用的類似的套件。例如，我們將使用 [Babel](https://babeljs.io/)。請放心，我們的目標是使這本書盡可能對初學者友好，為必要的套件提供最少的解釋。

## 環境設定

現在，讓我們快速進入環境設定！\
我將列出我們將使用的工具和版本：

- 執行期：[Node.js](https://nodejs.org/en) v26
- 語言：[TypeScript](https://www.typescriptlang.org/)
- 套件管理器：[pnpm](https://pnpm.io/) v12
- 建置工具：[Vite](https://vite.dev/) v8
- 工具鏈：[Vite+](https://viteplus.dev/guide/)

## 安裝 Node.js

你們大多數人可能都熟悉這一步。請自行設定。我們將跳過這裡的詳細解釋。

## 安裝 pnpm

你們中的許多人可能通常使用 npm 或 yarn。對於這本書，我們將使用 pnpm，所以請也安裝它。命令大多與 npm 相似。
https://pnpm.io/installation

## 安裝 Vite+

在本書中，我們使用 Vite+ 的 `vp` 命令來建立專案和啟動開發伺服器。  
請一併安裝它。  
https://viteplus.dev/guide/


## 建立專案

::: details 急於開始的快速啟動...

雖然我將解釋手動建立專案的步驟，但實際上有一個為設定準備的工具。
如果您覺得手動過程繁瑣，請隨時使用這個工具！

1. 複製 chibivue。

   ```sh
   $ git clone https://github.com/chibivue-land/chibivue
   ```

2. 執行腳本。
   輸入您想要設定的目錄路徑。

   ```sh
   $ cd chibivue
   $ vp install
   $ vp run setup:book ../my-chibivue-project
   ```

:::

在您選擇的任何目錄中建立專案。為了方便起見，我們將專案的根路徑表示為 `~`（例如，`~/src/main.ts`）。

這次，我們將把主要的「chibivue」與測試其功能的遊樂場分開。遊樂場將簡單地呼叫「chibivue」並用 Vite 打包它。我們預期這樣的結構。

```
~
|- examples
|    |- playground
|
|- packages
|- pnpm-workspace.yaml
|- tsconfig.json
|- vite.config.ts
```

我們將在名為「examples」的目錄中實作遊樂場。
我們將在「packages」中實作 chibivue 的核心 TypeScript 檔案，並從示例端匯入它們。

整個專案將構成一個 pnpm workspace，「examples」下的遊樂場作為 workspace 的套件來處理。  
啟動開發伺服器等命令不使用 npm scripts，而是定義為 Vite+ 的任務執行器 [Vite Task](https://viteplus.dev/guide/run)（`vp run`）的任務。

以下是建置它的步驟。

### 建置主專案

```sh
## 請建立一個專門用於 chibivue 的目錄並導航到其中。（此後將省略此類註釋。）
pwd # ~/
pnpm init
vp add -D @types/node vite-plus
mkdir packages
touch packages/index.ts
touch tsconfig.json
touch pnpm-workspace.yaml
```

pnpm-workspace.yaml 的內容

```yaml
packages:
  - examples/*
```

這樣，「examples」下的目錄就會被當作 workspace 的套件來處理。

tsconfig.json 的內容

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["DOM", "ES2020"],
    "strict": true,
    "paths": {
      "chibivue": ["./packages"]
    },
    "moduleResolution": "Bundler",
    "allowJs": true,
    "esModuleInterop": true
  },
  "include": ["packages/**/*.ts", "examples/**/**.ts"],
  "exclude": ["node_modules", "dist"]
}
```

packages/index.ts 的內容

```ts
console.log("Hello, World")
```

### 建置遊樂場端

```sh
pwd # ~/
mkdir examples
cd examples
vp create vite --no-interactive --no-agent --no-hooks -- playground --template vanilla-ts

## --------- 指定的內容
## Project name: playground
## Framework: Vanilla
## Variant: TypeScript
```

從用 Vite 建立的專案中移除不必要的檔案。

```sh
pwd # ~/examples/playground
rm -rf public
rm -rf src # 我們將重新建立它，因為有不必要的檔案。
mkdir src
touch src/main.ts
```

src/main.ts 的內容

※ 現在，「from」後面會有錯誤，但我們將在接下來的步驟中解決這個問題，所以沒有問題。

```ts
import "chibivue"
```

按如下方式修改 index.html。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>chibivue</title>
  </head>

  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

在 Vite 專案中設定別名，以便能夠匯入您在 chibivue 中實作的內容。

用以下內容建立 vite.config.ts。（如果已經存在，請改寫它。）

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite-plus'

const dirname = path.dirname(fileURLToPath(new URL(import.meta.url)))
export default defineConfig({
  resolve: {
    alias: {
      chibivue: path.resolve(dirname, '../../packages'),
    },
  },
  run: {
    tasks: {
      dev: { command: 'vp dev', cache: false },
      build: 'vp build',
      preview: { command: 'vp preview', dependsOn: ['build'], cache: false },
    },
  },
})
```

`run.tasks` 是 Vite Task 的任務定義。  
`command` 中寫要執行的命令，`dependsOn` 中寫需要先執行的任務。（`preview` 會在 `build` 完成之後執行。）  
對於開發伺服器這樣不會結束的任務，或者不想快取結果的任務，請指定 `cache: false`。

既然已經定義為任務，`vp create vite` 在 package.json 中產生的 `scripts`（`dev` / `build` / `preview`）就不再需要了。讓我們把它們刪除。

按如下方式修改 tsconfig.json。

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ESNext", "DOM"],
    "moduleResolution": "Node",
    "strict": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "skipLibCheck": true,
    "paths": {
      "chibivue": ["../../packages"]
    }
  },
  "include": ["src"]
}
```

最後，讓我們在 chibivue 專案的根目錄定義一個啟動遊樂場的任務並嘗試啟動它！

用以下內容建立 ~/vite.config.ts。

```ts
import { defineConfig } from 'vite-plus'

export default defineConfig({
  run: {
    tasks: {
      dev: { command: 'vp run playground#dev', cache: false },
    },
  },
})
```

`playground#dev` 的意思是「`playground` 套件的 `dev` 任務」。  
像這樣寫成 `套件名#任務名`，就可以指定 workspace 內其他套件的任務。

```sh
pwd # ~
vp install
vp run dev
```

`vp install` 會一次安裝整個 workspace（根目錄和 examples/playground）的相依套件。

在瀏覽器中開啟此命令啟動的開發伺服器。如果畫面顯示訊息，就表示設定完成。

![Hello chibivue rendered in the browser](/figures/00-introduction/setup-project/hello-chibivue-result.png)

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls//00_introduction/010_project_setup)
