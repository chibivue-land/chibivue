# 如何進行本書學習和環境設置

## 如何進行本書學習

我們將立即開始 Vue.js 的簡單實現．以下是一些需要記住的要點，注意事項和其他重要資訊：

- 項目名稱將是「chibivue」．我們將把本書中涵蓋的基本 Vue.js 實現稱為「chibivue」．
- 如最初提到的，我們的主要方法將是「重複小型開發」．
- 每個階段的源代碼都包含在本書的附錄中，可以在 https://github.com/chibivue-land/chibivue/tree/main/book/impls 找到．我們不會在書中為所有源代碼提供詳細解釋，所以請根據需要參考附錄．
- 最終代碼依賴於幾個套件．DIY 內容的一個常見問題是關於「應該手工實現多少才能稱之為自製」的爭論．雖然我們不會在本書中手工編寫所有源代碼，但我們將積極使用與 Vue.js 官方代碼中使用的類似的套件．例如，我們將使用 [Babel](https://babeljs.io/)．請放心，我們的目標是使這本書盡可能對初學者友好，為必要的套件提供最少的解釋．

## 環境設置

現在，讓我們快速進入環境設置！\
我將列出我們將使用的工具和版本：

- 運行時：[Node.js](https://nodejs.org/en) v22
- 語言：[TypeScript](https://www.typescriptlang.org/)
- 套件管理器：[pnpm](https://pnpm.io/) v9
- 構建工具：[Vite](https://vite.dev/) v6

## 安裝 Node.js

你們大多數人可能都熟悉這一步．請自行設置．我們將跳過這裡的詳細解釋．

## 安裝 pnpm

你們中的許多人可能通常使用 npm 或 yarn．對於這本書，我們將使用 pnpm，所以請也安裝它．命令大多與 npm 相似．
https://pnpm.io/installation

除了上述內容，本書還使用 [ni](https://github.com/antfu/ni)，可以幽默地稱為「套件管理器管理器」．  
（它是由 Vue.js 核心團隊的 antfu 創建的．）

如果您還沒有設置它，請也安裝它：

```sh
$ npm i -g @antfu/ni
```

[ni](https://github.com/antfu/ni) 是一個方便的工具，可以自動為您在各種套件管理器之間切換．

有趣的是，這個工具也在 Vue.js 的實際開發中使用．  
https://github.com/vuejs/core/blob/main/.github/contributing.md#scripts

對於套件安裝，啟動開發伺服器和其他任務，我們將使用 ni 命令．

## 創建項目

::: details 急於開始的快速啟動...

雖然我將解釋手動創建項目的步驟，但實際上有一個為設置準備的工具．  
如果您覺得手動過程繁瑣，請隨時使用這個工具！

1. 克隆 chibivue．

   ```sh
   $ git clone https://github.com/chibivue-land/chibivue
   ```

2. 執行腳本．  
   輸入您想要設置的目錄路徑．

   ```sh
   $ cd chibivue
   $ nr setup ../my-chibivue-project
   ```

:::

在您選擇的任何目錄中創建項目．為了方便起見，我們將項目的根路徑表示為 `~`（例如，`~/src/main.ts`）．

這次，我們將把主要的「chibivue」與測試其功能的遊樂場分開．遊樂場將簡單地調用「chibivue」並用 Vite 打包它．我們預期這樣的結構．

```
~
|- examples
|    |- playground
|
|- packages
|- tsconfig.js
```

我們將在名為「examples」的目錄中實現遊樂場．
我們將在「packages」中實現 chibivue 的核心 TypeScript 文件，並從示例端導入它們．

以下是構建它的步驟．

### 構建主項目

```sh
## 請創建一個專門用於 chibivue 的目錄並導航到其中。（此後將省略此類註釋。）
pwd # ~/
pnpm init
ni -D @types/node
mkdir packages
touch packages/index.ts
touch tsconfig.json
```

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

### 構建遊樂場端

```sh
pwd # ~/
mkdir examples
cd examples
nlx create-vite

## --------- 使用 Vite CLI 設置
## Project name: playground
## Select a framework: Vanilla
## Select a variant: TypeScript
```

從用 Vite 創建的項目中刪除不必要的項目．

```sh
pwd # ~/examples/playground
rm -rf public
rm -rf src # 我們將重新創建它，因為有不必要的文件。
mkdir src
touch src/main.ts
```

src/main.ts 的內容

※ 現在，「from」後面會有錯誤，但我們將在接下來的步驟中解決這個問題，所以沒有問題．

```ts
import "chibivue"
```

按如下方式修改 index.html．

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

在 Vite 項目中配置別名，以便能夠導入您在 chibivue 中實現的內容．

```sh
pwd # ~/examples/playground
touch vite.config.js
```

vite.config.js 的內容

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const dirname = path.dirname(fileURLToPath(new URL(import.meta.url)))
export default defineConfig({
  resolve: {
    alias: {
      chibivue: path.resolve(dirname, '../../packages'),
    },
  },
})
```

按如下方式修改 tsconfig.json．

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

最後，讓我們在 chibivue 項目的 package.json 中添加一個命令來啟動遊樂場並嘗試啟動它！

將以下內容附加到 ~/package.json

```json
{
  "scripts": {
    "dev": "cd examples/playground && pnpm i && pnpm run dev"
  }
}
```

```sh
pwd # ~
nr dev
```

訪問使用此命令啟動的開發伺服器．如果顯示消息，則設置完成．

![hello chibivue](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/hello_chibivue.png)

到此為止的源代碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls//00_introduction/010_project_setup)
