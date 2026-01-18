# リアクティビティシステムの前程知識

## 今回目指す開発者インタフェース

ここからは Vue.js の醍醐味であるリアクティビティシステムというものについてやっていきます．

<KawaikoNote variant="surprise" title="いよいよ本番！">

ここからが Vue.js の真髄です！\
リアクティビティシステムを理解すれば、Vue.js の「魔法」の正体がわかります。\
少し難しいですが、一緒に頑張りましょう！

</KawaikoNote>

これ以前の実装は，見た目が Vue.js に似ていれど，それは見た目だけで機能的には全く Vue.js ではありません．
たんに最初の開発者インタフェースを実装し，いろんな HTML を表示できるようにしてみました．

しかし，このままでは一度画面を描画するとその後はそのままで，Web アプリケーションとしてはただの静的なサイトになってしまっています．  
これから，もっとリッチな UI を構築するために状態を持たせたり，その状態が変わったら描画を更新したりといったことをやっていきます．

まずは例の如くどういった開発者インタフェースになるか考えてみましょう．  
以下のようなのはどうでしょうか?

```ts
import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })

    const increment = () => {
      state.count++
    }

    return () =>
      h('div', { id: 'my-app' }, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, ['increment']),
      ])
  },
})

app.mount('#app')
```

普段 SFC を利用した開発を行っている方は少々見慣れないかもしれません．  
これは，setup というオプションでステートをもち，render 関数を return する開発者インタフェースです．  
実際，Vue.js にはこういった記法があります．

https://vuejs.org/api/composition-api-setup.html#usage-with-render-functions

reactive 関数でステートを定義し，それを書き換える increment という関数を実装してボタンの click イベントにバインドしています．
やりたいことをまとめておくと，

- setup 関数を実行することで戻り値から vnode 取得用の関数を得る
- reactive 関数に渡したオブジェクトをリアクティブにする
- ボタンをクリックすると，ステートが更新される
- ステートの更新を追跡して render 関数を再実行し，画面を再描画する

## リアクティビティシステムとはどのようなもの？

さてここで，そもそもリアクティブとは何だったかのおさらいです．\
公式ドキュメントを参照してみます．

> リアクティブなオブジェクトは JavaScript プロキシで、通常のオブジェクトと同じように振る舞います。違いは、Vue がリアクティブなオブジェクトのプロパティアクセスと変更を追跡できることです。

[引用元](https://ja.vuejs.org/guide/essentials/reactivity-fundamentals.html)

> Vue の最も特徴的な機能の 1 つは、控えめな Reactivity System です。コンポーネントの状態はリアクティブな JavaScript オブジェクトで構成されています。状態を変更すると、ビュー (View) が更新されます。

[引用元](https://ja.vuejs.org/guide/extras/reactivity-in-depth.html)

要約してみると，「リアクティブなオブジェクトは変更があった時に画面が更新される」です．  
これの実現方法について考えるのは少し置いておいて，とりあえず先ほどあげた開発者インタフェースを実装してみます．

## setup 関数の実装

やることはとっても簡単です．
setup オプションを受け取り実行し，あとはそれをこれまでの render オプションと同じように使えば OK です．

~/packages/runtime-core/componentOptions.ts を編集します．

```ts
export type ComponentOptions = {
  render?: Function
  setup?: () => Function // 追加
}
```

あとはそれを使うように各コードを修正します．

```ts
// createAppAPI

const app: App = {
  mount(rootContainer: HostElement) {
    const componentRender = rootComponent.setup!()

    const updateComponent = () => {
      const vnode = componentRender()
      render(vnode, rootContainer)
    }

    updateComponent()
  },
}
```

```ts
// playground

import { createApp, h } from 'chibivue'

const app = createApp({
  setup() {
    // ゆくゆくはここでステートを定義
    // const state = reactive({ count: 0 })

    return function render() {
      return h('div', { id: 'my-app' }, [
        h('p', { style: 'color: red; font-weight: bold;' }, ['Hello world.']),
        h(
          'button',
          {
            onClick() {
              alert('Hello world!')
            },
          },
          ['click me!'],
        ),
      ])
    }
  },
})

app.mount('#app')
```

まあ，これだけです．
実際にはステートが変更された時にこの `updateComponent` を実行したいわけです．

## Proxy オブジェクト

今回のメインテーマです．どうにかしてステートが変更された時に updateComponent を実行したいです．

Proxy と呼ばれるオブジェクトが肝になっています．

<KawaikoNote variant="question" title="Proxy って何？">

Proxy は JavaScript の標準機能で、Vue.js 独自のものではありません。\
「オブジェクトへのアクセスを監視・カスタマイズできる仕組み」と覚えておきましょう！\
これを使えば「値が読まれた」「値が変更された」を検知できるのです。

</KawaikoNote>

まず，リアクティビティシステムの実装方法についてではなく，それぞれについての説明をしてみます．

https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Proxy

Proxy はとても面白いオブジェクトです．

以下のように，引数にオブジェクトを渡し，new することで使います．

```ts
const o = new Proxy({ value: 1 }, {})
console.log(o.value) // 1
```

この例だと，`o` は通常のオブジェクトとほぼ同じ動作をします．

ここで，面白いのが，Proxy は第 2 引数を取ることができ，ハンドラを登録することができます．  
このハンドラは何のハンドラかというと，オブジェクトの操作に対するハンドラです．以下の例をみてください．

```ts
const o = new Proxy(
  { value: 1, value2: 2 },

  {
    get(target, key, receiver) {
      console.log(`target:${target}, key: ${key}`)
      return target[key]
    },
  },
)
```

この例では生成するオブジェクトに対する設定を書き込んでいます．  
具体的には，このオブジェクトのプロパティにアクセス (get) した際に元のオブジェクト (target) とアクセスされた key 名がコンソールに出力されるようになっています．
実際にブラウザ等で動作を確認してみましょう．

![proxy_get](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/proxy_get.png)

この Proxy で生成したオブジェクトのプロパティから値を読み取った時に設定された処理が実行されているのがわかるかと思います．

同様に，set に対しても設定することができます．

```ts
const o = new Proxy(
  { value: 1, value2: 2 },
  {
    set(target, key, value, receiver) {
      console.log('hello from setter')
      target[key] = value
      return true
    },
  },
)
```

![proxy_set](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/proxy_set.png)

<KawaikoNote variant="funny" title="これがリアクティビティの秘密！">

get で「読み取り」、set で「書き込み」を検知できる…\
つまり、set のタイミングで「画面を更新する処理」を呼べば、**値が変わったら自動で画面が更新される** という魔法が実現できるのです！

</KawaikoNote>

Proxy の理解はこの程度で OK です．

