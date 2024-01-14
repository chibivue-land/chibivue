# 初めてのレンダリングと createApp API

## Vue.js の開発者インタフェース

## 何から始めよう? 🤔

さて、ここからどんどん chibivue を実装していきます。
どのように実装していくのがいいでしょうか ?

これは著者がいつも心がけていることですが、何か既存のソフトウェアを自作するときにはまずそのソフトウェアはどうやって使うのかということから考えます。  
この、「ソフトウェアを実際に使うときのインタフェース」のことをここからは便宜上「`開発者インタフェース`」と呼ぶことにします。  
ここでいう「開発者」とは、chibivue の開発者のことではなく、chibivue を使って Web アプリケーションを開発する人のことです。  
つまりは chibivue を開発するにあたって今一度本家 Vue.js の開発者インタフェースを参考にしてみます。  
具体的には Vue.js で Web アプリケーションを開発する際にまず何を書くかというところを見てみます。

## 開発者インタフェースのレベル? 🤔

ここで気をつけたいのは、Vue.js には複数の開発者インタフェースがあり、それぞれレベルが違うということです。  
ここでいうレベルというのは「どれくらい生の JavaScript に近いか」ということです。  
例えば、Vue で HTML を表示するための開発者インタフェースの例として以下のようなものが挙げられます。

1. Single File Component で template を書く

```vue
<!-- App.vue -->
<template>
  <div>Hello world.</div>
</template>
```

```ts
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
app.mount('#app')
```

2. template オプションを使用する

```ts
import { createApp } from 'vue'

const app = createApp({
  template: '<div>Hello world.</div>',
})

app.mount('#app')
```

3. render オプションと h 関数を利用する

```ts
import { createApp, h } from 'vue'

const app = createApp({
  render() {
    return h('div', {}, ['Hello world.'])
  },
})

app.mount('#app')
```

他にもありますが、このような 3 つの開発者インタフェースについて考えてみます。  
どれが一番生の JavaScript に近いでしょうか?  
答えは、3 の`render オプションと h 関数を利用する`です。  
1 は SFC のコンパイラやそれらをバンドルするバンドラーの実装が必要ですし、2 は template に渡された HTML をコンパイル(そのままでは動かないので JS のコードに変換)する必要があります。

ここでは便宜上、生の JS に近ければ近いほど「`低級な開発者インタフェース`」と呼ぶことにします。  
そして、ここで重要なのが、「実装を始めるときは低級なところから実装していく」ということです。  
それはなぜかというと、多くの場合、高級な記述は低級な記述に変換されて動いているからです。  
つまり、1 も 2 も最終的には内部的に 3 の形に変換しているのです。  
その変換の実装のことを「コンパイラ (翻訳機)」と呼んでいます。

ということで、まずは 3 のような開発者インタフェースを目指して実装していきましょう!

## createApp API とレンダリング

## 方針

3 の形を目指すとはいったもののまだ h 関数についてはよく分かっていないですし、なんといってもこの本はインクリメンタルな開発を目指しているので、  
いきなり 3 の形を目指すのはやめて、以下のような形で render 関数ではメッセージを return してそれを表示するだけの実装をしてみましょう。

イメージ ↓

```ts
import { createApp } from 'vue'

const app = createApp({
  render() {
    return 'Hello world.'
  },
})

app.mount('#app')
```

## 早速実装

`~/packages/index.ts`に createApp 関数を作ってみましょう。
※ helloChibivue は不要なので消してしまいます。

```ts
export type Options = {
  render: () => string
}

export type App = {
  mount: (selector: string) => void
}

export const createApp = (options: Options): App => {
  return {
    mount: selector => {
      const root = document.querySelector(selector)
      if (root) {
        root.innerHTML = options.render()
      }
    },
  }
}
```

とても簡単ですね。playground の方で試してみましょう。

`~/examples/playground/src/main.ts`

```ts
import { createApp } from 'chibivue'

const app = createApp({
  render() {
    return 'Hello world.'
  },
})

app.mount('#app')
```

画面にメッセージを表示することができました! やったね!

![hello_createApp](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/hello_createApp.png)

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/010_create_app)

## リファクタリング

「え？まだこれだけしか実装していないのにリファクタするの？」と思うかもしれませんが、この本の目的の一つに「Vue.js のソースコードを読めるようになる」というものがありました。  
それに伴って、ファイルやディレクトリ構成も Vue.js の形を常に意識したいわけです。  
なので、少しばかりリファクタさせてください。。。

### Vue.js の設計

#### runtime-core と runtime-dom

ここで少し Vue.js 本家の構成についての説明です。  
今回のリファクタでは `runtime-core` というディレクトリと `runtime-dom` というディレクトリを作ります。

それぞれなんなのかというと、runtime-core というのは、Vue.js のランタイム機能のうち本当にコアになる機能が詰まっています。  
と言われても何がコアで何がコアじゃないのか今の段階だとわかりづらいと思います。

なので、runtime-dom との関係を見てみるとわかりやすいかなと思います。  
runtime-dom というのは名前の通り、DOM に依存した実装を置くディレクトリです。ざっくり「ブラウザに依存した処理」という理解をしてもらえれば問題ないです。  
例を挙げると querySelector や createElement などの DOM 操作が含まれます。

runtime-core ではそういった処理は書かず、あくまで純粋な TypeScript の世界の中で Vue.js のランタイムに関するコアロジックを記述するような設計になっています。  
例を挙げると、 Virtual DOM に関する実装であったり、コンポーネントに関する実装だったりです。  
まあ、この辺りに関しては chibivue の開発が進むにつれて明確になってくると思うのでわからなかったらとりあえず本の通りにリファクタしてもらえれば問題ありません。

#### 各ファイルの役割と依存関係

これから runtime-core と runtime-dom にいくつかファイルを作ります。必要なファイルは以下のとおりです。

```sh
pwd # ~
mkdir packages/runtime-core
mkdir packages/runtime-dom

## core
touch packages/runtime-core/index.ts
touch packages/runtime-core/apiCreateApp.ts
touch packages/runtime-core/component.ts
touch packages/runtime-core/componentOptions.ts
touch packages/runtime-core/renderer.ts

## dom
touch packages/runtime-dom/index.ts
touch packages/runtime-dom/nodeOps.ts
```

これらの役割についてですが、最初から文章で説明してもわかりづらいかと思いますので以下の図を見てください。

![refactor_createApp!](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/refactor_createApp.png)

#### renderer の設計

先ほども話したとおり、Vue.js では DOM に依存する部分と純粋な Vue.js のコア機能部分を分離しています。
まず、注目して欲しいのは`runtime-core`の方の renderer factory と `runtime-dom`の nodeOps です。
先ほど実装した例だと、createApp が返す app の mount メソッドで直接レンダリングをしていました。

```ts
// これは先ほどのコード
export const createApp = (options: Options): App => {
  return {
    mount: selector => {
      const root = document.querySelector(selector)
      if (root) {
        root.innerHTML = options.render() // レンダリング
      }
    },
  }
}
```

ここまでではコードも少なく、全く複雑ではないので一見問題ないように見えます。  
ですが、今後は Virtual DOM のパッチレンダリングのロジック等を書くことになるのでかなり複雑になります。
Vue.js ではこのレンダリングを担う部分を`renderer`として切り出しています。
それが`runtime-core/renderer.ts`です。
レンダリングというと SPA においてはブラウザの DOM を司る API(document)に依存することが安易に想像できると思います。(element を作ったり text をセットしたり)
そこで、この DOM に依存する部分と Vue.js が持つコアなレンダーロジックを切り離すために、いくつかの工夫がしてあります。
以下のとおりです。

- `runtime-dom/nodeOps`に DOM 操作をするためのオブジェクトを実装する
- `runtime-core/renderer`ではあくまで、render のロジックのみを持つオブジェクトを生成するためのファクトリ関数を実装する。  
  その際、Node(DOM に限らず)を扱うオブジェクトは factory の関数の引数として受け取るようにしてある。
- `runtime-dom/index.ts`で nodeOps と renderer のファクトリをもとに renderer を完成させる

ここまでの話が図の赤く囲まれた部分です。
![refactor_createApp_render](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/refactor_createApp_render.png)

ソースコードベースで説明してみます。今の時点ではまだ Virtual DOM のレンダリング機能は実装していないので、先ほどと同じ機能で作ります。

まず、`runtime-core/renderer`に Node(DOM に限らず)のオペレーション用オブジェクトの interface を実装します。

```ts
export interface RendererOptions<HostNode = RendererNode> {
  setElementText(node: HostNode, text: string): void
}

export interface RendererNode {
  [key: string]: any
}

export interface RendererElement extends RendererNode {}
```

ここではまだ setElementText という関数しかありませんが、ゆくゆくは createElement だったり、removeChild などが実装されるイメージをしてもらえれば大丈夫です。

RendererNode と RendererElement については一旦気にしないでください。(ここの実装はあくまで DOM に依存してはいけないので、Node となるものを定義してジェネリックにしているだけです。)  
この、RendererOptions を受け取る形で renderer のファクトリをこのファイルに実装します。

```ts
export type RootRenderFunction<HostElement = RendererElement> = (
  message: string,
  container: HostElement,
) => void

export function createRenderer(options: RendererOptions) {
  const { setElementText: hostSetElementText } = options

  const render: RootRenderFunction = (message, container) => {
    hostSetElementText(container, message) // 今回はメッセージを挿入するだけなのでこういう実装になっている
  }

  return { render }
}
```

続いて、`runtime-dom/nodeOps` 側の実装です。

```ts
import { RendererOptions } from '../runtime-core'

export const nodeOps: RendererOptions<Node> = {
  setElementText(node, text) {
    node.textContent = text
  },
}
```

特に難しいことはないと思います。

それでは、`runtime-dom/index.ts` で renderer を完成させましょう。

```ts
import { createRenderer } from '../runtime-core'
import { nodeOps } from './nodeOps'

const { render } = createRenderer(nodeOps)
```

これで renderer 部分のリファクタは終わりです。

#### DI と DIP

renderer の設計を見てみました。改めて整理をしておくと、

- runtime-core/renderer に renderer を生成するファクトリ関数を実装
- runtime-dom/nodeOps に DOM に依存するオペレーション(操作)をするためのオブジェクトを実装
- runtime-dom/index にてファクトリ関数と nodeOps を組み合わせて renderer を生成

といった感じでした。  
一般的にはこのような設計を「DIP」を利用した「DI」と言います。  
まず、DIP についてですが、DIP(Dependency inversion principle)インタフェースを実装することにより、依存性の逆転を行います。  
注目するべきところは、renderer.ts に実装した `RendererOptions` という interface です。  
ファクトリ関数も、nodeOps もこの `RendererOptions` を守るように実装します。(RendererOptions というインタフェースに依存させる)  
これを利用して DI を行います。DI (Dependency Injection)はあるオブジェクトが依存しているあるオブジェクトを外から注入することによって依存度を下げるテクニックです。  
今回のケースでいうと、renderer は RendererOptions(を実装したオブジェクト(今回でいえば nodeOps))に依存しています。  
この依存性を renderer から直接呼び出して実装するのはやめて、ファクトリの引数として受け取る(外から注入する)ようにしています。  
これらのテクニックによって renderer が DOM に依存しないような工夫をとっています。

DI と DIP は慣れていないと難しい概念かもしれませんが、よく出てくる重要なテクニックなので各自で調べてもらったりして理解していただけると幸いです。

### createApp を完成させる

実装に話を戻して、renderer が生成できたのであとは以下の図の赤い領域について考えれば良いです。

![refactor_createApp_createApp](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/refactor_createApp_createApp.png)

と、いってもやることは単純で、createApp のファクトリ関数に先ほど作った renderer を渡せるように実装すれば良いだけです。

```ts
// ~/packages/runtime-core apiCreateApp.ts

import { Component } from './component'
import { RootRenderFunction } from './renderer'

export interface App<HostElement = any> {
  mount(rootContainer: HostElement | string): void
}

export type CreateAppFunction<HostElement> = (
  rootComponent: Component,
) => App<HostElement>

export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent) {
    const app: App = {
      mount(rootContainer: HostElement) {
        const message = rootComponent.render!()
        render(message, rootContainer)
      },
    }

    return app
  }
}
```

```ts
// ~/packages/runtime-dom/index.ts

import {
  CreateAppFunction,
  createAppAPI,
  createRenderer,
} from '../runtime-core'
import { nodeOps } from './nodeOps'

const { render } = createRenderer(nodeOps)
const _createApp = createAppAPI(render)

export const createApp = ((...args) => {
  const app = _createApp(...args)
  const { mount } = app
  app.mount = (selector: string) => {
    const container = document.querySelector(selector)
    if (!container) return
    mount(container)
  }

  return app
}) as CreateAppFunction<Element>
```

多少`~/packages/runtime-core/component.ts`等に型を移動してますが、その辺はあまり重要ではないのでソースコードを参照してもらえればと思います。(本家 Vue.js に合わせているだけです。)

だいぶ本家 Vue.js のソースコードに近づいたところで動作確認をしてみましょう。変わらずメッセージが表示されていれば OK です。

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/010_create_app2)
