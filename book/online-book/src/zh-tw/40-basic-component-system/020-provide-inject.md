# Provide/Inject 的實現

## 讓我們實現 Provide/Inject

這是 Provide 和 Inject 的實現。實現也相當簡單。  
基本概念是在 ComponentInternalInstance 中有一個地方來儲存提供的資料（provides），並保持父組件的實例來繼承資料。

需要注意的一點是，provide 有兩個入口點。一個是在組件的 setup 期間，這很容易想像，  
另一個是在 App 上呼叫 provide 時。

```ts
const app = createApp({
  setup() {
    //.
    //.
    //.
    provide('key', someValue) // 這是從組件呼叫 provide 的情況
    //.
    //.
  },
})

app.provide('key2', someValue2) // 在 App 上提供
```

現在，我們應該在哪裡儲存 app 提供的內容？由於 app 不是組件，這是一個問題。

為了給你答案，讓我們說 app 實例有一個名為 AppContext 的物件，我們將在其中儲存 provides 物件。

將來，我們將向這個 AppContext 添加全域組件和自訂指令設定。

現在我們已經解釋了到目前為止的一切，讓我們實現程式碼，使其按以下方式工作！

※ 假設的簽名

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

到此為止的原始碼：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/40_basic_component_system/020_provide_inject)
