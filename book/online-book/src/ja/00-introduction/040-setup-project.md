# 本書の進め方と環境構築

## Web Playground について

本書では，各チャプターの実装コードをブラウザ上で直接試せる **Web Playground** を用意しています．
環境構築なしで，すぐにコードを編集・実行できるので，まずはこちらで chibivue の動作を体験してみてください！

### Playground の起動方法

```sh
$ git clone https://github.com/chibivue-land/chibivue
$ cd chibivue
$ pnpm install
$ pnpm play:generate
$ pnpm play
```

ブラウザで表示された URL (例: `http://localhost:5173/`) にアクセスすると Playground が起動します．

### Playground の構成

![web_playground_initial](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/web_playground_initial.png)

Playground は以下の 4 つのエリアで構成されています．

| エリア | 説明 |
|--------|------|
| **Explorer (左)** | プロジェクトのファイルツリーを表示します．ファイルをクリックするとエディタで開きます |
| **Editor (中央)** | Monaco Editor でコードを編集できます |
| **Preview (右)** | WebContainer 上で動作する開発サーバーのプレビューを表示します |
| **Terminal / Console (下)** | ターミナル出力と console.log の内容を確認できます |

### 使い方

1. **チャプターを選択する**
   画面上部のドロップダウンから学習したいチャプターを選択します．
   検索ボックスでチャプター名を絞り込むこともできます．

2. **Run をクリックする**
   「Run」ボタンをクリックすると，WebContainer が起動し，依存関係のインストールと開発サーバーの起動が行われます．
   初回は少し時間がかかりますが，しばらく待つと Preview エリアに結果が表示されます．

3. **コードを編集する**
   エディタでコードを編集し，「Apply」ボタンをクリックすると変更が適用されます．
   HMR (Hot Module Replacement) により，変更がリアルタイムで反映されます．

4. **コンソールを確認する**
   「Console」タブをクリックすると，console.log などの出力を確認できます．

![web_playground_console](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/web_playground_console.png)

::: tip
Web Playground は [WebContainer](https://webcontainers.io/) を使用しています．
一部のブラウザや環境では動作しない場合があります．その場合は，以下のローカル環境構築を参考にしてください．
:::

## 本書の進め方

これから早速 Vue.js の実装を小さく行なっていきます．  
それに伴う心構えや注意点，その他知っておくべき情報を以下に列挙します．

- プロジェクト名は chibivue とします．  
  本書で実装する Vue.js の基本実装をまとめて chibivue と呼ぶことにします．
- 基本方針は最初に話した通り，「小さい開発を繰り返す」です．
- この本の付録として各フェーズのソースコードを https://github.com/chibivue-land/chibivue/tree/main/book/impls に載せてあります．  
  この本では具体的な説明を全てのソースコードに対して行うわけではないので，その辺りは随時こちらを参照していただければと思います．
- 完成系のコードはいくつかのパッケージに依存しています．  
  これは自作系のコンテンツにありがちな問題なのですが，「どこからどこまで自分の手で実装すれば自作と言えるのだろう」という議論がしばしば挙げられます．  
  例によってこの本も全てのソースコードを手で書くわけではありません．  
  今回は Vue.js 本家のコードが使っているようなパッケージは積極的に使っていきます．例えば，[Babel](https://babeljs.io/) がその一つです．  
  しかし安心してもらいたいのは，今回の本では前程知識を必要としないことを目指しているので必要になったパッケージについて必要最低限説明を加えます．

## 環境構築

さて，早速ですが環境構築からやっていきましょう！\
一応先に今回構築する環境の内容を列挙しておきます

- ランタイム: [Node.js](https://nodejs.org/en) v24
- 言語: [TypeScript](https://www.typescriptlang.org/)
- パッケージマネージャ: [pnpm](https://pnpm.io/) v10
- ビルドツール: [Vite](https://vite.dev/) v8

## Node.js インストール

おそらくここは大丈夫でしょう．各自で用意してください．
説明については省略します．

## pnpm のインストール

もしかすると普段は npm や yarn を使っている方が多いかもしれません．  
今回は pnpm を使っていくので，こちらの方も合わせてインストールしてください．  
基本的なコマンドは npm とほとんど一緒です．  
https://pnpm.io/installation


## プロジェクトの作成

::: details 手っ取り早くスタートしたい ...
これから，手動でプロジェクトを作成する手順を説明するのですが，実は構築用のツールも用意しています．  
面倒くさい方は是非こちらを使ってください！

1. chibivue をクローンする

   ```sh
   $ git clone https://github.com/chibivue-land/chibivue
   ```

2. script を実行.  
   セットアップしたいディレクトリのパスを入力してください.

   ```sh
   $ cd chibivue
   $ pnpm setup:book ../my-chibivue-project
   ```

:::

任意のディレクトリでプロジェクトを作成します．
ここからは便宜上プロジェクトのルートパスを`~`と表現します．(例: `~/src/main.ts`など)

今回は，chibivue の本体と動作を確認するためのプレイグラウンドを分けて実装してみます．
といってもプレイグラウンド側で chibivue を呼び出して vite でバンドルするだけです．
このような構成にする想定です．

```

~
|- examples
| |- playground
|
|- packages
|- tsconfig.json

```

examples というディレクトリにプレイグラウンドを実装します．
packages に chibivue 本体の TypeScript ファイル群を実装して，example 側からそれを import する形にします．

以下はそれを構築する手順です．

### プロジェクト本体の構築

```sh
## 実際はchibivue用のディレクトリを作って移動してください (以下、同様の注釈は省略します。)
pwd # ~/
pnpm init
pnpm add -D @types/node
mkdir packages
touch packages/index.ts
touch tsconfig.json
```

tsconfig.json の内容

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

packages/index.ts の内容

```ts
console.log("Hello, World");
```

### プレイグラウンド側の構築

```sh
pwd # ~/
mkdir examples
cd examples
pnpm dlx create-vite

## --------- create vite cliの設定
## Project name: playground
## Select a framework: Vanilla
## Select a variant: TypeScript
```

vite で作成したプロジェクトのうち，不要なものを削除します．

```sh
pwd # ~/examples/playground
rm -rf public
rm -rf src # 不要なファイルがあるので一旦作り直します。
mkdir src
touch src/main.ts
```

src/main.ts の中身
※ 一旦 from の後ろのエラーが出ますがこれから設定するので問題ありません．

```ts
import "chibivue"
```

index.html を以下のように書き換えます．

```html
<!DOCTYPE html>
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

Vite で作成したプロジェクトで chibivue で実装したものを import できるようにエイリアスの設定をします．

```sh
pwd # ~/examples/playground
touch vite.config.js
```

vite.config.js の内容

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

tsconfig.json の中身を以下のように書き換えます．

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": [
      "ESNext",
      "DOM"
    ],
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
      "chibivue": [
        "../../packages"
      ],
    }
  },
  "include": [
    "src"
  ]
}
```

最後に，chibivue プロジェクトの package.json に playground を起動するコマンドを記述して実際に起動してみましよう！

~/package.json に以下を追記

```json
{
  "scripts": {
    "dev": "cd examples/playground && pnpm i && pnpm run dev"
  }
}
```

```sh
pwd # ~
pnpm dev
```

このコマンドで立ち上がった開発者サーバーにアクセスし，メッセージが表示されていれば完了です！

![hello chibivue](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/hello_chibivue.png)

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/00_introduction/010_project_setup)
