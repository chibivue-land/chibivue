# Provide/Inject の実装

## Provide/Inject を実装しよう

Provide と Inject の実装です。こちらも実装は至ってシンプルです。  
基本的なコンセプトとしては、 ComponentInternalInstance に provides (provide されたデータを格納する場所)と、親コンポーネントのインスタンスを保持しておいて、データを受け継ぐだけです。

一点、注意する点としては、provide のエントリポイントは 2 種類あるということで、一つはコンポーネントの setup 時という想像のつきやすいものですが、  
もう一つは App の provide を呼ぶケースです。

```ts
const app = createApp({
  setup() {
    //.
    //.
    //.
    provide('key', someValue) // これはコンポーネントから provide するケース
    //.
    //.
  },
})

app.provide('key2', someValue2) // App に provide
```

さて、app で provide したものはどこに保持しておきましょう ? app はコンポーネントではないですからね。困りました。

答えを言ってしまうと、app のインスタンスに AppContext というオブジェクトを持つことにして、provides というオブジェクトをこの中で保持するようにします。

この、AppContext には将来的にグローバルコンポーネントやカスタムディレクティブの設定を持たせます。

さて、ここまでで説明するべきことは揃ったので、概ね以下のようなコードが動くように実装してみましょう！

※ 想定しているシグネチャ

```ts
export interface InjectionKey<_T> extends Symbol {}

export function provide<T, K = InjectionKey<T> | string | number>(
  key: K,
  value: K extends InjectionKey<infer V> ? V : T,
)

export function inject<T>(key: InjectionKey<T> | string): T | undefined
export function inject<T>(key: InjectionKey<T> | string, defaultValue: T): T
```

```ts
const Child = {
  setup() {
    const rootState = inject<{ count: number }>('RootState')
    const logger = inject(LoggerKey)

    const action = () => {
      rootState && rootState.count++
      logger?.('Hello from Child.')
    }

    return () => h('button', { onClick: action }, ['action'])
  },
}

const app = createApp({
  setup() {
    const state = reactive({ count: 1 })
    provide('RootState', state)

    return () =>
      h('div', {}, [h('p', {}, [`${state.count}`]), h(Child, {}, [])])
  },
})

type Logger = (...args: any) => void
const LoggerKey = Symbol() as InjectionKey<Logger>

app.provide(LoggerKey, window.console.log)
```

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/020_provide_inject)
