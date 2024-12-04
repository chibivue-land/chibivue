# テンプレートコンパイラ

## 実はここまでで動作に必要なものは揃った ( ? )

これまで， Reactivity System や Virtual DOM ，Component などを実装してきました．  
これらは非常に小さなもので，実用的なものではないのですが，実は動作に必要な構成要素の全体像としては一通り理解できたと言っても過言ではないのです．  
それぞれの要素自体の機能は足りていないですが，浅〜〜〜〜〜く 1 周した感じです．

このチャプターからはより Vue.js に近づけるためにテンプレートの機能を実装するのですが，これらはあくまで DX の改善のためのものであり，ランタイムに影響を出すものではありません．(厳密にはコンパイラ最適化により影響はでますが，本筋ではないので出ない，としておきます)  
もう少し具体的にいうと，DX の向上のために開発者インタフェースを拡張し，「最終的には今まで作った内部実装に変換」します．

## 今回実現したい開発者インタフェース

今現時点ではこのような開発者インタフェースになっています．

```ts
const MyComponent: Component = {
  props: { someMessage: { type: String } },

  setup(props: any, { emit }: any) {
    return () =>
      h('div', {}, [
        h('p', {}, [`someMessage: ${props.someMessage}`]),
        h('button', { onClick: () => emit('click:change-message') }, [
          'change message',
        ]),
      ])
  },
}

const app = createApp({
  setup() {
    const state = reactive({ message: 'hello' })
    const changeMessage = () => {
      state.message += '!'
    }

    return () =>
      h('div', { id: 'my-app' }, [
        h(
          MyComponent,
          {
            'some-message': state.message,
            'onClick:change-message': changeMessage,
          },
          [],
        ),
      ])
  },
})
```

現状だと，View の部分は h 関数を使って構築しています．より生の HTML に近づけるために template オプションに template を描けるようにしたいです．\
とは言っても，いきなり色々モリモリで実装するのは大変なので，少し機能を絞って作ってみます．\
とりあえず，以下のようなタスクに分割してやっていきます．

1. 単純なタグとメッセージ，静的な属性を描画できるように

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

2. もう少し複雑な HTML を描画できるように

```ts
const app = createApp({
  template: `
    <div>
      <p>hello</p>
      <button> click me! </button>
    </div>
  `,
})
```

3. setup 関数で定義したものを使えるようにしたい

```ts
const app = createApp({
  setup() {
    const count = ref(0)
    const increment = () => {
      count.value++
    }

    return { count, increment }
  },

  template: `
    <div>
      <p>count: {{ count }}</p>
      <button v-on:click="increment"> click me! </button>
    </div>
  `,
})
```

それぞれでさらに小さく分割はしていくのですが，おおまかにこの 3 ステップに分割してみます．  
まずは 1 からやっていきましょう．

## コンパイラがやっていること

さて，今回目指す開発者インタフェースは以下のようなものです．

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

ここでまず，コンパイラとはいったいなんなのかという話だけしておきます．  
ソフトウェアを書いているとたちまち「コンパイラ」という言葉を耳にするかと思います．  
「コンパイル」というのは翻訳という意味で，ソフトウェアの領域だとより高級な記述から低級な記述へ変換する際によくこの言葉を使います．\
この本の最初の方のこの言葉を覚えているでしょうか?

> ここでは便宜上、生の JS に近ければ近いほど「低級な開発者インタフェース」と呼ぶことにします。  
> そして、ここで重要なのが、「実装を始めるときは低級なところから実装していく」ということです。  
> それはなぜかというと、多くの場合、高級な記述は低級な記述に変換されて動いているからです。  
> つまり、1 も 2 も最終的には内部的に 3 の形に変換しているのです。  
> その変換の実装のことを「コンパイラ (翻訳機)」と呼んでいます。

では，このコンパイラというものがなぜ必要なのかということについてですが，それは「開発体験を向上させる」というのが大きな目的の一つです．  
最低限，動作するような低級なインタフェースが備わっていれば，機能としてはそれらだけで開発を進めることは可能です．  
ですが，記述がわかりづらかったり，機能に関係のない部分を考慮する必要が出てきたりと色々と面倒な問題がでてくるのはしんどいので，利用者の気持ちを考えてインタフェースの部分だけを再開発します．

この点で，Vue.js が目指している点は，「生の HTML のように書けかつ，Vue が提供する機能(ディレクティブなど)を活用して便利に View を書く」と言ったところでしょうか．
そして，そこの行き着く先が SFC といったところでしょうか．\
昨今では jsx/tsx の流行もあり，Vue はもちろんこれらも開発者インタフェースの選択肢として提供しています．が，今回は Vue 独自の template を実装する方向でやってみようと思います．

長々と，文章で説明してしまいましたが，結局今回やりたいことは，

このようなコードを，

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

このように翻訳(コンパイル)する機能を実装したいです．

```ts
const app = createApp({
  render() {
    return h('p', { class: 'hello' }, ['Hello World'])
  },
})
```

もう少しスコープを狭めるなら，この部分です．

```ts
`<p class="hello">Hello World</p>`
// ↓
h('p', { class: 'hello' }, ['Hello World'])
```

いくつかのフェーズに分けて，段階的に実装を進めていきましょう．

