# 初めてのレンダリングと createApp API

## 何から始めよう? 🤔

さて，ここからどんどん chibivue を実装していきます．
どのように実装していくのがいいでしょうか ?

これは著者がいつも心がけていることですが，何か既存のソフトウェアを自作するときにはまずそのソフトウェアはどうやって使うのかということから考えます．  
この，「ソフトウェアを実際に使うときのインタフェース」のことをここからは便宜上「`開発者インタフェース`」と呼ぶことにします．  
ここでいう「開発者」とは，chibivue の開発者のことではなく，chibivue を使って Web アプリケーションを開発する人のことです．  
つまりは chibivue を開発するにあたって今一度本家 Vue.js の開発者インタフェースを参考にしてみます．  
具体的には Vue.js で Web アプリケーションを開発する際にまず何を書くかというところを見てみます．

## 開発者インタフェースのレベル? 🤔

ここで気をつけたいのは，Vue.js には複数の開発者インタフェースがあり，それぞれレベルが違うということです．  
ここでいうレベルというのは「どれくらい生の JavaScript に近いか」ということです．  
例えば，Vue で HTML を表示するための開発者インタフェースの例として以下のようなものが挙げられます．

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

他にもありますが，このような 3 つの開発者インタフェースについて考えてみます．  
どれが一番生の JavaScript に近いでしょうか?  
答えは，3 の`render オプションと h 関数を利用する`です．  
1 は SFC のコンパイラやそれらをバンドルするバンドラーの実装が必要ですし，2 は template に渡された HTML をコンパイル(そのままでは動かないので JS のコードに変換)する必要があります．

ここでは便宜上，生の JS に近ければ近いほど「`低級な開発者インタフェース`」と呼ぶことにします．  
そして，ここで重要なのが，「実装を始めるときは低級なところから実装していく」ということです．  
それはなぜかというと，多くの場合，高級な記述は低級な記述に変換されて動いているからです．  
つまり，1 も 2 も最終的には内部的に 3 の形に変換しているのです．  
その変換の実装のことを「コンパイラ (翻訳機)」と呼んでいます．

ということで，まずは 3 のような開発者インタフェースを目指して実装していきましょう!

## createApp API とレンダリング

## 方針

3 の形を目指すとはいったもののまだ h 関数についてはよく分かっていないですし，なんといってもこの本はインクリメンタルな開発を目指しているので，  
いきなり 3 の形を目指すのはやめて，以下のような形で render 関数ではメッセージを return してそれを表示するだけの実装をしてみましょう．

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

`~/packages/index.ts`に createApp 関数を作ってみましょう．\
※ `"Hello, World"` の出力は不要なので消してしまいます．

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

とても簡単ですね．playground の方で試してみましょう．

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

![hello_createApp](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/hello_createApp.png)

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/010_create_app)

