# 小さい Reactivity System

## 今回目指す開発者インタフェース

ここからは Vue.js の醍醐味である Reactivity System というものについてやっていきます。  
これ以前の実装は、見た目が Vue.js に似ていれど、それは見た目だけで機能的には全く Vue.js ではありません。  
たんに最初の開発者インタフェースを実装し、いろんな HTML を表示できるようにしてみました。

しかし、このままでは一度画面を描画するとその後はそのままで、Web アプリケーションとしてはただの静的なサイトになってしまっています。  
これから、もっとリッチな UI を構築するために状態を持たせたり、その状態が変わったら描画を更新したりといったことをやっていきます。

まずは例の如くどういった開発者インタフェースになるか考えてみましょう。  
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

普段 SFC を利用した開発を行っている方は少々見慣れないかもしれません。  
これは、setup というオプションでステートをもち、render 関数を return する開発者インタフェースです。  
実際、Vue.js にはこういった記法があります。

https://vuejs.org/api/composition-api-setup.html#usage-with-render-functions

reactive 関数でステートを定義し、それを書き換える increment という関数を実装してボタンの click イベントにバインドしています。
やりたいことをまとめておくと、

- setup 関数を実行することで戻り値から vnode 取得用の関数を得る
- reactive 関数に渡したオブジェクトをリアクティブにする
- ボタンをクリックすると、ステートが更新される
- ステートの更新を追跡して render 関数を再実行し、画面を再描画する

## Reactivity System とはどのようなもの?

さてここで、そもそもリアクティブとは何だったかのおさらいです。
公式ドキュメントを参照してみます。

> リアクティブなオブジェクトは JavaScript プロキシで、通常のオブジェクトと同じように振る舞います。違いは、Vue がリアクティブなオブジェクトのプロパティアクセスと変更を追跡できることです。

[引用元](https://ja.vuejs.org/guide/essentials/reactivity-fundamentals.html)

> Vue の最も特徴的な機能の 1 つは、控えめな Reactivity System です。コンポーネントの状態はリアクティブな JavaScript オブジェクトで構成されています。状態を変更すると、ビュー (View) が更新されます。

[引用元](https://ja.vuejs.org/guide/extras/reactivity-in-depth.html)

要約してみると、「リアクティブなオブジェクトは変更があった時に画面が更新される」です。  
これの実現方法について考えるのは少し置いておいて、とりあえず先ほどあげた開発者インタフェースを実装してみます。

## setup 関数の実装

やることはとっても簡単です。
setup オプションをを受け取り実行し、あとはそれをこれまでの render オプションと同じように使えば OK です。

~/packages/runtime-core/componentOptions.ts を編集します。

```ts
export type ComponentOptions = {
  render?: Function
  setup?: () => Function // 追加
}
```

あとはそれを使うように各コードを修正します。

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

まあ、これだけです。
実際にはステートが変更された時にこの `updateComponent` を実行したいわけです。

## Proxy オブジェクト

今回のメインテーマです。どうにかしてステートが変更された時に updateComponent を実行したいです。

Proxy と呼ばれるオブジェクトが肝になっています。

まず、 Reactivity System の実装方法についてではなく、それぞれについての説明をしてみます。

https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Proxy

Proxy はとても面白いオブジェクトです。

以下のように、引数にオブジェクトを渡し、new することで使います。

```ts
const o = new Proxy({ value: 1 }, {})
console.log(o.value) // 1
```

この例だと、`o` は通常のオブジェクトとほぼ同じ動作をします。

ここで、面白いのが、Proxy は第 2 引数を取ることができ、ハンドラを登録することができます。  
このハンドラは何のハンドラかというと、オブジェクトの操作に対するハンドラです。以下の例をみてください。

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

この例では生成するオブジェクトに対する設定を書き込んでいます。  
具体的には、このオブジェクトのプロパティにアクセス(get)した際に元のオブジェクト(target)とアクセスされた key 名がコンソールに出力されるようになっています。
実際にブラウザ等で動作を確認してみましょう。

![proxy_get](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/proxy_get.png)

この Proxy で生成したオブジェクトのプロパティから値を読み取った時に設定された処理が実行されているのがわかるかと思います。

同様に、set に対しても設定することができます。

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

![proxy_set](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/proxy_set.png)

Proxy の理解はこの程度で OK です。

## Proxy で Reactivity System を実現してみる

::: warning
2023 年 の 12 月末に [Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) がリリースされましたが、これには [reactivity のパフォーマンス改善](https://github.com/vuejs/core/pull/5912) が含まれています。  
このオンラインブックはそれ以前の実装を参考にしていることに注意しくてださい。  
このチャプターに関しては大きな変更はありませんが、ファイル構成が少し違っていたり、コードの一部が変更されていたりします。  
然るべきタイミングでこのオンラインブックも追従する予定です。  
:::

改めて目的を明確にしておくと、今回の目的は「ステートが変更された時に `updateComponent` を実行したい」です。  
Proxy を用いた実装の流れについて説明してみます。

まず、Vue.js の Reactivity System には `target`, `Proxy`, `ReactiveEffect`, `Dep`, `track`, `trigger`, `targetMap`, `activeEffect`というものが登場します。

まず、targetMap の構造についてです。  
targetMap はある target の key と dep のマッピングです。  
target というのはリアクティブにしたいオブジェクト、dep というのは実行したい作用(関数)だと思ってもらえれば大丈夫です。  
コードで表すとこういう感じになります。

```ts
type Target = any // 任意のtarget
type TargetKey = any // targetが持つ任意のkey

const targetMap = new WeakMap<Target, KeyToDepMap>() // このモジュール内のグローバル変数として定義

type KeyToDepMap = Map<TargetKey, Dep> // targetのkeyと作用のマップ

type Dep = Set<ReactiveEffect> // depはReactiveEffectというものを複数持っている

class ReactiveEffect {
  constructor(
    // ここに実際に作用させたい関数を持たせます。 (今回でいうと、updateComponent)
    public fn: () => T,
  ) {}
}
```

基本的な構造はこれが担っていて、あとはこの TargetMap をどう作っていくか(どう登録していくか)と実際に作用を実行するにはどうするかということを考えます。

そこで登場する概念が `track` と `trigger` です。
それぞれ名前の通り、`track` は `TargetMap` に登録する関数、`trigger` は `TargetMap` から作用を取り出して実行する関数です。

```ts
export function track(target: object, key: unknown) {
  // ..
}

export function trigger(target: object, key?: unknown) {
  // ..
}
```

そして、この track と trigger は Proxy の get と set のハンドラに実装されます。

```ts
const state = new Proxy(
  { count: 1 },
  {
    get(target, key, receiver) {
      track(target, key)
      return target[key]
    },
    set(target, key, value, receiver) {
      target[key] = value
      trigger(target, key)
      return true
    },
  },
)
```

この Proxy 生成のための API が reactive 関数です。

```ts
function reactive<T>(target: T) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key)
      return target[key]
    },
    set(target, key, value, receiver) {
      target[key] = value
      trigger(target, key)
      return true
    },
  })
}
```

![reactive](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/reactive.drawio.png)

ここで、一つ足りない要素について気づくかもしれません。それは「track ではどの関数を登録するの?」という点です。
答えを言ってしまうと、これが `activeEffect` という概念です。
これは、targetMap と同様、このモジュール内のグローバル変数として定義されていて、ReactiveEffect の `run` というメソッドで随時設定されます。

```ts
let activeEffect: ReactiveEffect | undefined

class ReactiveEffect {
  constructor(
    // ここに実際に作用させたい関数を持たせます。 (今回でいうと、updateComponent)
    public fn: () => T,
  ) {}

  run() {
    activeEffect = this
    return this.fn()
  }
}
```

どのような原理かというと、このようなコンポーネントを想像してください。

```ts
{
  setup() {
    const state = reactive({ count: 0 });
    const increment = () => state.count++;

    return function render() {
      return h("div", { id: "my-app" }, [
        h("p", {}, [`count: ${state.count}`]),
        h(
          "button",
          {
            onClick: increment,
          },
          ["increment"]
        ),
      ]);
    };
  },
}
```

これを、内部的には以下のようにリアクティブを形成します。

```ts
// chibivue 内部実装
const app: App = {
  mount(rootContainer: HostElement) {
    const componentRender = rootComponent.setup!()

    const updateComponent = () => {
      const vnode = componentRender()
      render(vnode, rootContainer)
    }

    const effect = new ReactiveEffect(updateComponent)
    effect.run()
  },
}
```

順を追って説明すると、まず、`setup` 関数が実行されます。
この時点で reactive proxy が生成されます。つまり、ここで作られた proxy に対してこれから何か操作があると proxy で設定した通り動作をとります。

```ts
const state = reactive({ count: 0 }) // proxyの生成
```

次に、`updateComponent` を渡して `ReactiveEffect` (Observer 側)を生成します。

```ts
const effect = new ReactiveEffect(updateComponent)
```

この `updateComponent` で使っている `componentRender` は `setup` の`戻り値`の関数です。そしてこの関数は proxy によって作られたオブジェクトを参照しています。

```ts
function render() {
  return h('div', { id: 'my-app' }, [
    h('p', {}, [`count: ${state.count}`]), // proxy によって作られたオブジェクトを参照している
    h(
      'button',
      {
        onClick: increment,
      },
      ['increment'],
    ),
  ])
}
```

実際にこの関数が走った時、`state.count` の `getter` 関数が実行され、`track` が実行されるようになっています。  
この状況下で、effect を実行してみます。

```ts
effect.run()
```

そうすると、まず `activeEffect` に `updateComponent` が設定されます。  
この状態で `track` が走るので、`targetMap` に `state.count` と `updateComponent` のマップが登録されます。  
これがリアクティブの形成です。

ここで、increment が実行された時のことを考えてみましょう。  
increment では `state.count` を書き換えているので `setter` が実行され、`trigger` が実行されます。  
`trigger` は `state` と `count` を元に `targetMap` から `effect`(今回の例だと updateComponent)をみつけ、実行します。
これで画面の更新が行われるようになりました!

これによって、リアクティブを実現することができます。

ちょっとややこしいので図でまとめます。

![reactivity_create](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/reactivity_create.drawio.png)

## これらを踏まえて実装しよう

一番難しいところは上記までの理解なので、理解ができればあとはソースコードを書くだけです。  
とは言っても、実際のところどうなってるのかよく分からず上記だけでは理解ができない方もいるでしょう。  
そんな方も一旦ここで実装してみましょう。それから実際のコードを読みながら先ほどのセクションを見返してもらえたらと思います!

まずは必要なファイルを作ります。`packages/reactivity`に作っていきます。
ここでも本家 Vue の構成をなるべく意識します。

```sh
pwd # ~
mkdir packages/reactivity

touch packages/reactivity/index.ts

touch packages/reactivity/dep.ts
touch packages/reactivity/effect.ts
touch packages/reactivity/reactive.ts
touch packages/reactivity/baseHandler.ts
```

例の如く、index.ts は export しているだけなので特に説明はしません。reactivity 外部パッケージから使いたくなったものはここから export しましょう。

dep.ts からです。

```ts
import { type ReactiveEffect } from './effect'

export type Dep = Set<ReactiveEffect>

export const createDep = (effects?: ReactiveEffect[]): Dep => {
  const dep: Dep = new Set<ReactiveEffect>(effects)
  return dep
}
```

effect の定義がないですがこれから実装するので Ok です。

続いて effect.ts です。

```ts
import { Dep, createDep } from './dep'

type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

export let activeEffect: ReactiveEffect | undefined

export class ReactiveEffect<T = any> {
  constructor(public fn: () => T) {}

  run() {
    // ※ fnを実行する前のactiveEffectを保持しておいて、実行が終わった後元に戻します。
    // これをやらないと、どんどん上書きしてしまって、意図しない挙動をしてしまいます。(用が済んだら元に戻そう)
    let parent: ReactiveEffect | undefined = activeEffect
    activeEffect = this
    const res = this.fn()
    activeEffect = parent
    return res
  }
}

export function track(target: object, key: unknown) {
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = createDep()))
  }

  if (activeEffect) {
    dep.add(activeEffect)
  }
}

export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key)

  if (dep) {
    const effects = [...dep]
    for (const effect of effects) {
      effect.run()
    }
  }
}
```

track と trigger の中身についてこれまで解説していないのですが、単純に targetMap に登録をしたり取り出して実行したりしているだけなので頑張って読んでみてください。

続いて baseHandler.ts です。ここには reactive proxy のハンドラを定義します。  
まあ、reactive に直接実装してもいいのですが、本家がこうなっているので真似してみました。  
実際には readonly や shallow などさまざまなプロキシが存在するのでそれらのハンドラをここに実装するイメージです。(今回はやりませんが)

```ts
import { track, trigger } from './effect'
import { reactive } from './reactive'

export const mutableHandlers: ProxyHandler<object> = {
  get(target: object, key: string | symbol, receiver: object) {
    track(target, key)

    const res = Reflect.get(target, key, receiver)
    // objectの場合はreactiveにしてあげる (これにより、ネストしたオブジェクトもリアクティブにすることができます。)
    if (res !== null && typeof res === 'object') {
      return reactive(res)
    }

    return res
  },

  set(target: object, key: string | symbol, value: unknown, receiver: object) {
    let oldValue = (target as any)[key]
    Reflect.set(target, key, value, receiver)
    // 値が変わったかどうかをチェックしてあげておく
    if (hasChanged(value, oldValue)) {
      trigger(target, key)
    }
    return true
  },
}

const hasChanged = (value: any, oldValue: any): boolean =>
  !Object.is(value, oldValue)
```

ここで、Reflect というものが登場していますが、Proxy と似た雰囲気のものなんですが、Proxy があるオブジェクトに対する設定を書き込む処理だったのに対し、Reflect はあるオブジェクトに対する処理を行うものです。  
Proxy も Reflect も JS エンジン内のオブジェクトにまつわる処理の API で、普通にオブジェクトを使うのと比べてメタなプログラミングを行うことができます。  
そのオブジェクトを変化させる関数を実行したり、読み取る関数を実行したり、key が存在するのかをチェクしたりさまざまなメタ操作ができます。  
とりあえず、Proxy = オブジェクトを作る段階でのメタ設定、 Reflect = 既に存在しているオブジェクトに対するメタ操作くらいの理解があれば OK です。

続いて reactive.ts です。

```ts
import { mutableHandlers } from './baseHandler'

export function reactive<T extends object>(target: T): T {
  const proxy = new Proxy(target, mutableHandlers)
  return proxy as T
}
```

これで reactive 部分の実装は終わりなので、mount する際に実際にこれらを使ってみましょう。  
`~/packages/runtime-core/apiCreateApp.ts`です。

```ts
import { ReactiveEffect } from '../reactivity'

export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent) {
    const app: App = {
      mount(rootContainer: HostElement) {
        const componentRender = rootComponent.setup!()

        const updateComponent = () => {
          const vnode = componentRender()
          render(vnode, rootContainer)
        }

        // ここから
        const effect = new ReactiveEffect(updateComponent)
        effect.run()
        // ここまで
      },
    }

    return app
  }
}
```

さて、あとは playground で試してみましょう。

```ts
import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => {
      state.count++
    }

    return function render() {
      return h('div', { id: 'my-app' }, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, ['increment']),
      ])
    }
  },
})

app.mount('#app')
```

![reactive_example_mistake](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/reactive_example_mistake.png)

あっ………

ちゃんとレンダリングはされるようになりましたが何やら様子がおかしいです。
まぁ、無理もなくて、`updateComponent`では毎回要素を作っています。
なので、2 回目以降のレンダリングの際に古いものはそのままで、新しく要素が作られてしまっているのです。
なので、レンダリング前に毎回要素を全て消してあげましょう。

`~/packages/runtime-core/renderer.ts`の render 関数をいじります。

```ts
const render: RootRenderFunction = (vnode, container) => {
  while (container.firstChild) container.removeChild(container.firstChild) // 全消し処理を追加
  const el = renderVNode(vnode)
  hostInsert(el, container)
}
```

さてこれでどうでしょう。

![reactive_example](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/reactive_example.png)

今度は大丈夫そうです!

これで reactive に画面を更新できるようになりました!!

ここまでのソースコード: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/030_reactive_system)
