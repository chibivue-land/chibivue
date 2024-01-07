# スロット

## デフォルトスロットの実装

Vue にはスロットと呼ばれる機能があります。そしてこのスロットには、default slot, named slot, scoped slot の 3 種類があります。  
https://vuejs.org/guide/components/slots.html#slots

今回はこれらのうち、デフォルトスロットを実装していきます。
目指す開発者インタフェースは以下のようなものです。

https://vuejs.org/guide/extras/render-function.html#passing-slots

```ts
const MyComponent = defineComponent({
  setup(_, { slots }) {
    return () => h('div', {}, [slots.default()])
  },
})

const app = createApp({
  setup() {
    return () => h(MyComponent, {}, () => 'hello')
  },
})
```

仕組みは単純で、スロットの定義側では、setupContext として slots を受け取れるようにしておき、使用する側で h 関数でコンポーネントをレンダリングする際に、children としてレンダー関数を渡すだけです。
おそらく、皆さんが最も馴染み深い使い方は、SFC で template に slot 要素を置いたりする使い方だとは思うのですが、そちらは別途 template のコンパイラを実装する必要があるので、今回は省略します。(Basic Template Compiler 部門で扱います。)

例の如く、インスタンスに slots を保持しておけるプロパティを追加し、createSetupContext で SetupContext として混ぜます。  
h 関数も第 3 引数として配列だけではなく、レンダー関数を受け取れるような形にして、レンダー関数が来た場合にはコンポーネントのインスタンスを生成するタイミングでインスタンスの default slot として設定してあげます。  
とりあえずここまで実装してみましょう！

(children の normalize 実装に伴って ShapeFlags を少々変更しています。)

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/050_component_slot)

## 名前付きスロット/スコープ付きスロットの実装

デフォルトスロットの拡張です。  
今度は関数ではなく、オブジェクトで渡せるようにしてみましょう。

スコープ付きスロットに関しては、レンダー関数の引数を定義してあげるだけです。  
これをみても分かる通り、レンダー関数を使用する際はスコープ付きスロットという区別をわざわざする必要もないように感じます。  
それはその通りで、スロットの正体はただのコールバック関数で、それに引数を持たせるためにスコープ付きスロットという名前で API を提供しています。  
もちろん、これから Basic Template Compiler の部門でスコープ付きスロットを扱えるようなコンパイラを実装しますが、それはこれらの形に変換されているのです。

https://vuejs.org/guide/components/slots.html#scoped-slots

```ts
const MyComponent = defineComponent({
  setup(_, { slots }) {
    return () =>
      h('div', {}, [
        slots.default?.(),
        h('br', {}, []),
        slots.myNamedSlot?.(),
        h('br', {}, []),
        slots.myScopedSlot2?.({ message: 'hello!' }),
      ])
  },
})

const app = createApp({
  setup() {
    return () =>
      h(
        MyComponent,
        {},
        {
          default: () => 'hello',
          myNamedSlot: () => 'hello2',
          myScopedSlot2: (scope: { message: string }) =>
            `message: ${scope.message}`,
        },
      )
  },
})
```

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/060_slot_extend)
