# 如何进行本书学习和环境设置

## 如何进行本书学习

我们将立即开始 Vue.js 的简单实现．以下是一些需要记住的要点，注意事项和其他重要信息：

- 项目名称将是"chibivue"．我们将把本书中涵盖的基本 Vue.js 实现称为"chibivue"．
- 如最初提到的，我们的主要方法将是"重复小型开发"．
- 每个阶段的源代码都包含在本书的附录中，可以在 https://github.com/chibivue-land/chibivue/tree/main/book/impls 找到．我们不会在书中为所有源代码提供详细解释，所以请根据需要参考附录．
- 最终代码依赖于几个包．DIY 内容的一个常见问题是关于"应该手工实现多少才能称之为自制"的争论．虽然我们不会在本书中手工编写所有源代码，但我们将积极使用与 Vue.js 官方代码中使用的类似的包．例如，我们将使用 [Babel](https://babeljs.io/)．请放心，我们的目标是使这本书尽可能对初学者友好，为必要的包提供最少的解释．

## 环境设置

现在，让我们快速进入环境设置！\
我将列出我们将使用的工具和版本：

- 运行时：[Node.js](https://nodejs.org/en) v22
- 语言：[TypeScript](https://www.typescriptlang.org/)
- 包管理器：[pnpm](https://pnpm.io/) v9
- 构建工具：[Vite](https://vite.dev/) v6

## 安装 Node.js

你们大多数人可能都熟悉这一步．请自行设置．我们将跳过这里的详细解释．

## 安装 pnpm

你们中的许多人可能通常使用 npm 或 yarn．对于这本书，我们将使用 pnpm，所以请也安装它．命令大多与 npm 相似．
https://pnpm.io/installation

除了上述内容，本书还使用 [ni](https://github.com/antfu/ni)，可以幽默地称为"包管理器管理器"．  
（它是由 Vue.js 核心团队的 antfu 创建的．）

如果您还没有设置它，请也安装它：

```sh
$ npm i -g @antfu/ni
```

[ni](https://github.com/antfu/ni) 是一个方便的工具，可以自动为您在各种包管理器之间切换．

有趣的是，这个工具也在 Vue.js 的实际开发中使用．  
https://github.com/vuejs/core/blob/main/.github/contributing.md#scripts

对于包安装，启动开发服务器和其他任务，我们将使用 ni 命令．

## 创建项目

::: details 急于开始的快速启动...

虽然我将解释手动创建项目的步骤，但实际上有一个为设置准备的工具．  
如果您觉得手动过程繁琐，请随时使用这个工具！

1. 克隆 chibivue．

   ```sh
   $ git clone https://github.com/chibivue-land/chibivue
   ```

2. 执行脚本．  
   输入您想要设置的目录路径．

   ```sh
   $ cd chibivue
   $ nr setup ../my-chibivue-project
   ```

:::

在您选择的任何目录中创建项目．为了方便起见，我们将项目的根路径表示为 `~`（例如，`~/src/main.ts`）．

这次，我们将把主要的"chibivue"与测试其功能的游乐场分开．游乐场将简单地调用"chibivue"并用 Vite 打包它．我们预期这样的结构．

```
~
|- examples
|    |- playground
|
|- packages
|- tsconfig.js
```

我们将在名为"examples"的目录中实现游乐场．
我们将在"packages"中实现 chibivue 的核心 TypeScript 文件，并从示例端导入它们．

以下是构建它的步骤．

### 构建主项目

```sh
## 请创建一个专门用于 chibivue 的目录并导航到其中。（此后将省略此类注释。）
pwd # ~/
pnpm init
ni -D @types/node
mkdir packages
touch packages/index.ts
touch tsconfig.json
```

tsconfig.json 的内容

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

packages/index.ts 的内容

```ts
console.log("Hello, World")
```

### 构建游乐场端

```sh
pwd # ~/
mkdir examples
cd examples
nlx create-vite

## --------- 使用 Vite CLI 设置
## Project name: playground
## Select a framework: Vanilla
## Select a variant: TypeScript
```

从用 Vite 创建的项目中删除不必要的项目．

```sh
pwd # ~/examples/playground
rm -rf public
rm -rf src # 我们将重新创建它，因为有不必要的文件。
mkdir src
touch src/main.ts
```

src/main.ts 的内容

※ 现在，"from"后面会有错误，但我们将在接下来的步骤中解决这个问题，所以没有问题．

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

在 Vite 项目中配置别名，以便能够导入您在 chibivue 中实现的内容．

```sh
pwd # ~/examples/playground
touch vite.config.js
```

vite.config.js 的内容

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

最后，让我们在 chibivue 项目的 package.json 中添加一个命令来启动游乐场并尝试启动它！

将以下内容附加到 ~/package.json

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

访问使用此命令启动的开发服务器．如果显示消息，则设置完成．

![hello chibivue](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/hello_chibivue.png)

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls//00_introduction/010_project_setup)
