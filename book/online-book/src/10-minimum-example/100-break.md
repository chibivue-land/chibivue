# ちょっと一息

## Minimal Example 部門はここまで！

冒頭で、この本はいくつかの部門に分かれるという話をしたのですが、それの一番最初の部門である「Minimal Example 部門」はここまでで終了です。お疲れ様でした。  
なぜ、わざわざ「部門」という呼び方にしているかというと、理由は２つあります。  
まず一つは、ここからはそれぞれの部門でなるべく依存関係を持たないような構成にすることで、それぞれが興味のある範囲(部門)での理解を深めることができるということを目指しているからです。  
Virtual DOM やパッチレンダリング周りに興味がある人は Basic Virtual DOM 部門に進めばいいですし、コンポーネントをもっと拡張したければ Basic Component 部門、  
テンプレートでもっと豊かな表現(ディレクティブなど)に興味があれば Basic Template Compiler 部門、script setup やコンパイラマクロに興味があれば Basic SFC Compiler 部門に進めば良いです。(勿論全部やってもいいですよ!!)  
そして何よりこのこの「Minimal Example 部門」もひとつの立派な部門なわけですから、「そんなに深くは知らなくてもいいけど、全体的にサラッとやりたい！」という方はここまでで十分なのです。  
(Web Application Essentials 部門に関しては、ある程度 Vue の Basic な実装に依存にする部分があるので、各部門の実装が少し混ざってしまっています。)

## ここまでで何ができるようになった？

最後に、少し Minimal Example 部門でやったこととできるようになったことを振り返ってみましょう。

## いつもみているものが何処の何なのか、分かるようになった

まず、createApp という最初の開発者インタフェースを通して、(Web アプリの)開発者と Vue の世界がどのようなふうに繋がっているのかを理解しました。  
具体的には、最初にやったリファクタを起点に、Vue のディレクトリ構造の基盤とそれぞれの依存関係、そして開発者が触っている部分はどこのなんなのかというのが分かるようになっているはずです。
ここらで今現状でのディレクトリと、vuejs/core のディレクトリを見比べてみましょう。

chibivue
![minimum_example_artifacts](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/minimum_example_artifacts.png)

※ 本家のコードはデカくてスクショに収まりきらないので割愛

https://github.com/vuejs/core

小さいなりに、それぞれのファイルの役割やその中身もそこそこ読めるようになっているのではないでしょうか。
ぜひ、今回触れていない部分のソースコードのコードリーディングにも挑戦してみてほしいです。(ぼちぼち読めるはずです！　)

## 宣言的 UI の実現方法が分かった

h 関数の実装を通して、宣言的 UI はどうやって実現されているかということについて理解しました。

```ts
// 内部的に {tag, props, children} のようなオブジェクトを生成し、それを元にDOM操作をしている
h('div', { id: 'my-app' }, [
  h('p', {}, ['Hello!']),
  h(
    'button',
    {
      onClick: () => {
        alert('hello')
      },
    },
    ['Click me!'],
  ),
])
```

ここで初めて Virtual DOM のようなものが登場しました。

## Reactivity System とは何か、どうやって画面を動的に更新していくかということが分かった

Vue の醍醐味である、Reactivity System がどのような実装で成り立っているのか、そもそも Reactivity System とはなんのことなのか、ということについて理解しました

```ts
const targetMap = new WeakMap<any, KeyToDepMap>()

function reactive<T extends object>(target: T): T {
  const proxy = new Proxy(target, {
    get(target: object, key: string | symbol, receiver: object) {
      track(target, key)
      return Reflect.get(target, key, receiver)
    },

    set(
      target: object,
      key: string | symbol,
      value: unknown,
      receiver: object,
    ) {
      Reflect.set(target, key, value, receiver)
      trigger(target, key)
      return true
    },
  })
}
```

```ts
const component = {
  setup() {
    const state = reactive({ count: 0 }) // create proxy

    const increment = () => {
      state.count++ // trigger
    }

    ;() => {
      return h('p', {}, `${state.count}`) // track
    }
  },
}
```

## Virtual DOM とはなんなのか、何が嬉しいのか、どうやって実装するのかが分かった

h 関数を使ったレンダリングの改善として、 Virtual DOM の比較による効率的なレンダリングの方法について理解しました。

```ts
// 仮想DOMのinterface
export interface VNode<HostNode = any> {
  type: string | typeof Text | object
  props: VNodeProps | null
  children: VNodeNormalizedChildren
  el: HostNode | undefined
}

// まず、render関数が呼ばれる
const render: RootRenderFunction = (rootComponent, container) => {
  const vnode = createVNode(rootComponent, {}, [])
  // 初回は n1 が null. この場合は各自 process で mount が走る
  patch(null, vnode, container)
}

const patch = (n1: VNode | null, n2: VNode, container: RendererElement) => {
  const { type } = n2
  if (type === Text) {
    processText(n1, n2, container)
  } else if (typeof type === 'string') {
    processElement(n1, n2, container)
  } else if (typeof type === 'object') {
    processComponent(n1, n2, container)
  } else {
    // do nothing
  }
}

// 2回目以降はひとつ前のVNodeと現在のVNodeをpatch関数に渡すことで差分を更新する
const nextVNode = component.render()
patch(prevVNode, nextVNode)
```

## コンポーネントの構造とコンポーネント間でのやりとりをどう実現するのかが分かった。

```ts
export interface ComponentInternalInstance {
  type: Component

  vnode: VNode
  subTree: VNode
  next: VNode | null
  effect: ReactiveEffect
  render: InternalRenderFunction
  update: () => void

  propsOptions: Props
  props: Data
  emit: (event: string, ...args: any[]) => void

  isMounted: boolean
}
```

```ts
const MyComponent = {
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

## コンパイラとは何か、テンプレートの機能はどう実現されているのかが分かった

コンパイラとはどのようなものかについて理解し、テンプレートのコンパイラを実装することで、より生の HTML に近く、かつマスタッシュ構文などの Vue 固有な機能についての実装を理解しました。

```ts
const app = createApp({
  setup() {
    const state = reactive({ message: 'Hello, chibivue!', input: '' })

    const changeMessage = () => {
      state.message += '!'
    }

    const handleInput = (e: InputEvent) => {
      state.input = (e.target as HTMLInputElement)?.value ?? ''
    }

    return { state, changeMessage, handleInput }
  },

  template: `
    <div class="container" style="text-align: center">
      <h2>{{ state.message }}</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
        alt="Vue.js Logo"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <button @click="changeMessage"> click me! </button>

      <br />

      <label>
        Input Data
        <input @input="handleInput" />
      </label>

      <p>input value: {{ state.input }}</p>

      <style>
        .container {
          height: 100vh;
          padding: 16px;
          background-color: #becdbe;
          color: #2c3e50;
        }
      </style>
    </div>
  `,
})
```

## Vite プラグインを通して SFC コンパイラの実現方法について理解した。

実装して template コンパイラを活用して、script, template, style を一つのファイルに記述するオリジナルのファイルフォーマットをどう実現するかについて理解しました。  
vite プラグインでどういうことができるのか、transform や仮想モジュールについて学びました。

```vue
<script>
import { reactive } from 'chibivue'

export default {
  setup() {
    const state = reactive({ message: 'Hello, chibivue!', input: '' })

    const changeMessage = () => {
      state.message += '!'
    }

    const handleInput = e => {
      state.input = e.target?.value ?? ''
    }

    return { state, changeMessage, handleInput }
  },
}
</script>

<template>
  <div class="container" style="text-align: center">
    <h2>{{ state.message }}</h2>
    <img
      width="150px"
      src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
      alt="Vue.js Logo"
    />
    <p><b>chibivue</b> is the minimal Vue.js</p>

    <button @click="changeMessage">click me!</button>

    <br />

    <label>
      Input Data
      <input @input="handleInput" />
    </label>

    <p>input value: {{ state.input }}</p>
  </div>
</template>

<style>
.container {
  height: 100vh;
  padding: 16px;
  background-color: #becdbe;
  color: #2c3e50;
}
</style>
```

## これからについて

これからは、より実用的なものにしていくにあたって、それぞれのパートをより詳しくやっていきます。
それに伴って、これ以降の各部門の最初のソースコードは「Minimal Example 部門の最後のソースコードの状態」からスタートします。  
そして、これから各部門でやることと、進め方(方針)について少し説明します。

## どういうことをやるのか

この本の冒頭と重複する部分も多いですが、改めて。  
ここからは 5 部門 + 付録 1 部門に分かれます。

- Basic Virtual DOM 部門
  - スケジューラの実装
  - 対応できていないパッチの実装 (主に属性周り)
  - Fragment の対応
- Basic Reactivity System 部門
  - ref api
  - computed api
  - watch api
- Basic Component System 部門
  - provide/inject
  - lifecycle hooks
- Basic Template Compiler 部門
  - v-on
  - v-bind
  - v-for
  - v-model
- Basic SFC Compiler 部門
  - SFC の基本
  - script setup
  - compiler macro
- Web Application Essentials 部門 (付録)

  この部門は付録です。Web 開発において、頻繁に Vue と共に利用されるライブラリの実装をします。
  この部門だけは、ある程度他の部門に依存する部分があります。
  勿論、この部門からやり始めて他の部門でやる必要な実装については随時やっていく、という方針でも問題はないですが、多少わかりづらい可能性はあります。

  - store
  - route

  ここでは上記の 2 つを扱いますが、ぜひ他にも思いつくものがあれば実装してみましょう！

## 方針について

Minimal Example 部門ではかなり細かめに実装の手順について説明してきました。  
ここまで実装してきた皆さんならば、もうかなり本家 Vue のソースコードを読めるようになっているはずです。  
そこでこれ以降の部では、説明は大まかな方針までにとどめて、実際のコードは本家のコードを読みながら、もしくは自分で考えながら実装していこうと思います。  
(け、決して、細かく書くのが面倒臭くなってきたとか、そういうことではないですからね！　)  
まあ、本を読んでその通りに実装するのは最初のうちは楽しいですが、ある程度形になってきたら自分でやってみるほうが楽しいですし、より深い理解にもつながるかと思います。  
ここから先はこの本はある種のガイドライン程度に捉えて貰って、本編は Vue 本家にあります！
