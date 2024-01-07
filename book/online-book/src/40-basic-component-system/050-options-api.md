# Options APIに対応する

## Options API

ここまででかなりのことを Composition API で実装することができるようになりましたが、Options API も対応してみましょう。

本書では以下を対応しています。

- props
- data
- computed
- method
- watch
- slot
- lifecycle
  - onMounted
  - onUpdated
  - onUnmounted
  - onBeforeMount
  - onBeforeUpdate
  - onBeforeUnmount
- provide/inject
- $el
- $data
- $props
- $slots
- $parent
- $emit
- $forceUpdate
- $nextTick

実装方針としては、componentOptions.ts に applyOptions という関数を用意し、setupComponent の最後の方で実行します。

```ts
export const setupComponent = (instance: ComponentInternalInstance) => {
  // .
  // .
  // .

  if (render) {
    instance.render = render as InternalRenderFunction
  }
  // ↑ ここまでは既存実装

  setCurrentInstance(instance)
  applyOptions(instance)
  unsetCurrentInstance()
}
```

Options API では this を頻繁に扱うような開発者インタフェースになっています。

```ts
const App = defineComponent({
  data() {
    return { message: 'hello' }
  },

  methods: {
    greet() {
      console.log(this.message) // こういうやつ
    },
  },
})
```

この this は内部的にはコンポーネントの proxy を指すようになっていて、オプションを apply する際にこの proxy を bind しています。

実装イメージ ↓

```ts
export function applyOptions(instance: ComponentInternalInstance) {
  const { type: options } = instance
  const publicThis = instance.proxy! as any
  const ctx = instance.ctx

  const { methods } = options

  if (methods) {
    for (const key in methods) {
      const methodHandler = methods[key]
      if (isFunction(methodHandler)) {
        ctx[key] = methodHandler.bind(publicThis)
      }
    }
  }
}
```

基本的にはこの原理を使って一つずつ実装していけば難しくないはずです。

data をリアクティブにしたければ reactive 関数をここで呼び出しますし、computed したければ computed 関数をここで呼び出します。 (provide/inject も同様)

applyOptions が実行される前には setCurrentInstance によってインスタンスがセットされているので、いつもと同じようにこれまで作ってきた api(CompositionAPI)を呼んであげれば OK です。

`$`から始まるプロパティについては componentPublicInstance の方の実装で、PublicInstanceProxyHandlers の getter で制御しています。

## Options API の型付

機能的には上記のように実装していけばいいのですが、Options API は型付が少々複雑です。

一応、本書では OptionsAPI に関しても基本的な型付はサポートしています。

難しいポイントとしては、各オプションのユーザーの定義によって this の型が変動する点です。data オプションで number 型の count というプロパティを定義した場合には computed や method での this には `count: number` が推論されたいわけです。

もちろん、data だけではなく computed や methods に定義されたものについても同様です。

```ts
const App = defineComponent({
  data() {
    return { count: 0 }
  },

  methods: {
    myMethod() {
      this.count // number
      this.myComputed // number
    },
  },

  computed: {
    myComputed() {
      return this.count // number
    },
  },
})
```

これを実現するには少々複雑な型パズルを実装する必要があります。(たくさんジェネリクスでバケツリレーします。)

defineComponent に対する型付を起点に、ComponentOptions, ComponentPublicInstance にリレーするためにいくつかの型を実装します。

ここでは一旦、data オプションと methods に絞って説明します。

まずはいつもの ComponentOptions という型です。
こちらもジェネリックに拡張し、data と methods の型を受け取れるように D と M というパラメータを取るようにします。

```ts
export type ComponentOptions<
  D = {},
  M extends MethodOptions = MethodOptions
> = {
  data?: () => D;,
  methods?: M;
};

interface MethodOptions {
  [key: string]: Function;
}
```

ここまでは特に難しくないかと思います。これが defineComponent の引数に当てられる型です。  
もちろん、defineComponent の方でも D と M を受け取れるようにします。これによってユーザーが定義した型をリレーしていけるようになります。

```ts
export function defineComponent<
  D = {},
  M extends MethodOptions = MethodOptions,
>(options: ComponentOptions<D, M>) {}
```

問題は method で扱う this に対して D をどうやって mix するか(どうやって this.count のような推論を可能にするか)です。

まず、手始めに D や M は ComponentPublicInstance にマージされる(proxy にマージされる)ので以下のようになることがわかるかと思います。(ジェネリックに拡張します。)

```ts
type ComponentPublicInstance<
  D = {},
  M extends MethodOptions = MethodOptions,
> = {
  /** public instance が持ついろんな型 */
} & D &
  M
```

ここまでできたら、ComponentOptions の this にインスタンスの型を混ぜ込みます。

```ts
type ComponentOptions<D = {}, M extends MethodOptions = MethodOptions> = {
  data?: () => D
  methods?: M
} & ThisType<ComponentPublicInstance<D, M>>
```

こうしておくことで、option 中の this から data や method に定義したプロパティを推論することができます。

実際には props であったり、computed, inject など様々な型を推論する必要がありますが、基本原理はこれと同じです。  
ぱっと見ジェネリクスがたくさんあったり、型の変換(inject から key だけを取り出したり)が混ざっているのでウッとなってしまうかもしれませんが落ち着いて原理に戻って実装すれば大丈夫なはずです。  
本書のコードでは本家の Vue をインスパイアして、`CreateComponentPublicInstance`という抽象化を一段階挟んでいたり、`ComponentPublicInstanceConstructor`と言う型を実装していますが、あまり気にしないでください。(興味があればそこも読んでみてください！　)

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/070_options_api)
