# パッケージの設計

## リファクタリング

「え？まだこれだけしか実装していないのにリファクタするの？」と思うかもしれませんが，この本の目的の一つに「Vue.js のソースコードを読めるようになる」というものがありました．  
それに伴って，ファイルやディレクトリ構成も Vue.js の形を常に意識したいわけです．  
なので，少しばかりリファクタさせてください．．．

### Vue.js の設計

#### runtime-core と runtime-dom

ここで少し Vue.js 本家の構成についての説明です．
今回のリファクタでは `runtime-core` というディレクトリと `runtime-dom` というディレクトリを作ります．

<KawaikoNote variant="question" title="なぜ分けるの？">

「動くコードができたのに、なぜわざわざ分割するの？」と思うかもしれません。\
実は Vue.js はブラウザだけでなく、サーバーサイドレンダリング（SSR）やネイティブアプリ（Vue Native）など、様々な環境で動作できるように設計されています。\
そのために、DOM に依存しない「純粋なロジック」と「DOM 操作」を分離しているのです。

</KawaikoNote>

それぞれなんなのかというと，runtime-core というのは，Vue.js のランタイム機能のうち本当にコアになる機能が詰まっています．
と言われても何がコアで何がコアじゃないのか今の段階だとわかりづらいと思います．

なので，runtime-dom との関係を見てみるとわかりやすいかなと思います．  
runtime-dom というのは名前の通り，DOM に依存した実装を置くディレクトリです．ざっくり「ブラウザに依存した処理」という理解をしてもらえれば問題ないです．  
例を挙げると querySelector や createElement などの DOM 操作が含まれます．

runtime-core ではそういった処理は書かず，あくまで純粋な TypeScript の世界の中で Vue.js のランタイムに関するコアロジックを記述するような設計になっています．  
例を挙げると，仮想 DOM に関する実装であったり，コンポーネントに関する実装だったりです．  
この辺りに関しては chibivue の開発が進むにつれて明確になってくると思うのでわからなかったらとりあえず本の通りにリファクタしてもらえれば問題ありません．

#### 各ファイルの役割と依存関係

これから runtime-core と runtime-dom にいくつかファイルを作ります．必要なファイルは以下のとおりです．

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

これらの役割についてですが，最初から文章で説明してもわかりづらいかと思いますので以下の図を見てください．

![refactor_createApp!](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/refactor_createApp.png)

#### renderer の設計

先ほども話したとおり，Vue.js では DOM に依存する部分と純粋な Vue.js のコア機能部分を分離しています．
まず，注目して欲しいのは `runtime-core` の方の renderer factory と `runtime-dom` の nodeOps です．
先ほど実装した例だと，createApp が返す app の mount メソッドで直接レンダリングをしていました．

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

ここまでではコードも少なく，全く複雑ではないので一見問題ないように見えます．  
ですが，今後は仮想 DOM のパッチレンダリングのロジック等を書くことになるのでかなり複雑になります．
Vue.js ではこのレンダリングを担う部分を `renderer` として切り出しています．
それが `runtime-core/renderer.ts` です．
レンダリングというと SPA においてはブラウザの DOM を司る API (document) に依存することが安易に想像できると思います．\
(element を作ったり text をセットしたり)\
そこで，この DOM に依存する部分と Vue.js が持つコアなレンダーロジックを切り離すために，いくつかの工夫がしてあります．\
以下のとおりです．

- `runtime-dom/nodeOps` に DOM 操作をするためのオブジェクトを実装する
- `runtime-core/renderer` ではあくまで，render のロジックのみを持つオブジェクトを生成するためのファクトリ関数を実装する．  
  その際，Node (DOM に限らず) を扱うオブジェクトは factory の関数の引数として受け取るようにしてある．
- `runtime-dom/index.ts` で nodeOps と renderer のファクトリをもとに renderer を完成させる

ここまでの話が図の赤く囲まれた部分です．
![refactor_createApp_render](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/refactor_createApp_render.png)

ソースコードベースで説明してみます．今の時点ではまだ仮想 DOM のレンダリング機能は実装していないので，先ほどと同じ機能で作ります．

まず，`runtime-core/renderer`に Node(DOM に限らず)のオペレーション用オブジェクトの interface を実装します．

```ts
export interface RendererOptions<HostNode = RendererNode> {
  setElementText(node: HostNode, text: string): void
}

export interface RendererNode {
  [key: string]: any
}

export interface RendererElement extends RendererNode {}
```

ここではまだ setElementText という関数しかありませんが，ゆくゆくは createElement だったり，removeChild などが実装されるイメージをしてもらえれば大丈夫です．

RendererNode と RendererElement については一旦気にしないでください．(ここの実装はあくまで DOM に依存してはいけないので，Node となるものを定義してジェネリックにしているだけです．)  
この，RendererOptions を受け取る形で renderer のファクトリをこのファイルに実装します．

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

続いて，`runtime-dom/nodeOps` 側の実装です．

```ts
import { RendererOptions } from '../runtime-core'

export const nodeOps: RendererOptions<Node> = {
  setElementText(node, text) {
    node.textContent = text
  },
}
```

特に難しいことはないと思います．

それでは，`runtime-dom/index.ts` で renderer を完成させましょう．

```ts
import { createRenderer } from '../runtime-core'
import { nodeOps } from './nodeOps'

const { render } = createRenderer(nodeOps)
```

これで renderer 部分のリファクタは終わりです．

#### DI と DIP

renderer の設計を見てみました．改めて整理をしておくと，

- runtime-core/renderer に renderer を生成するファクトリ関数を実装
- runtime-dom/nodeOps に DOM に依存するオペレーション (操作) をするためのオブジェクトを実装
- runtime-dom/index にてファクトリ関数と nodeOps を組み合わせて renderer を生成

といった感じでした．
一般的にはこのような設計を「DIP」を利用した「DI」と言います．

<KawaikoNote variant="warning" title="少し難しい話です">

DI と DIP は設計パターンの中でも難しい概念です。\
最初は「なんとなくこういうものか」程度の理解で大丈夫！\
コードを書いていくうちに「あ、こういうことか！」と分かってきます。

</KawaikoNote>

まず，DIP についてですが，DIP (Dependency inversion principle) インタフェースを実装することにより，依存性の逆転を行います．
注目するべきところは，renderer.ts に実装した `RendererOptions` という interface です．
ファクトリ関数も，nodeOps もこの `RendererOptions` を守るように実装します．(RendererOptions というインタフェースに依存させる)

<KawaikoNote variant="funny" title="例えで考えてみよう">

DIP を料理で例えると…\
「レシピ（interface）」があれば、材料が国産でも輸入品でも同じ料理が作れますよね。\
renderer（料理人）は「RendererOptions（レシピ）」に従うだけで、実際の材料（DOM 操作 or 他の操作）を気にしなくて良いのです。

</KawaikoNote>

これを利用して DI を行います．DI (Dependency Injection) はあるオブジェクトが依存しているあるオブジェクトを外から注入することによって依存度を下げるテクニックです．
今回のケースでいうと，renderer は RendererOptions (を実装したオブジェクト(今回でいえば nodeOps)) に依存しています．
この依存性を renderer から直接呼び出して実装するのはやめて，ファクトリの引数として受け取る (外から注入する) ようにしています．
これらのテクニックによって renderer が DOM に依存しないような工夫をとっています．

<KawaikoNote variant="base" title="まとめると">

**DIP**: 具体的な実装ではなく、interface（約束事）に依存させる\
**DI**: 依存するものを外から渡してもらう（注入する）

この2つを組み合わせることで、柔軟で テストしやすいコードが書けます！

</KawaikoNote>

DI と DIP は慣れていないと難しい概念かもしれませんが，よく出てくる重要なテクニックなので各自で調べてもらったりして理解していただけると幸いです．

### createApp を完成させる

実装に話を戻して，renderer が生成できたのであとは以下の図の赤い領域について考えれば良いです．

![refactor_createApp_createApp](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/refactor_createApp_createApp.png)

と，いってもやることは単純で，createApp のファクトリ関数に先ほど作った renderer を渡せるように実装すれば良いだけです．

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

多少 `~/packages/runtime-core/component.ts` 等に型を移動してますが，その辺はあまり重要ではないのでソースコードを参照してもらえればと思います．\
(本家 Vue.js に合わせているだけです．)

だいぶ本家 Vue.js のソースコードに近づいたところで動作確認をしてみましょう．変わらずメッセージが表示されていれば OK です．

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/015_package_architecture)
