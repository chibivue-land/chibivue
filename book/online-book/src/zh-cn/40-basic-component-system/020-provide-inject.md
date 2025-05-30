# Provide/Inject 的实现

## 让我们实现 Provide/Inject

这是 Provide 和 Inject 的实现。实现也相当简单。  
基本概念是在 ComponentInternalInstance 中有一个地方来存储提供的数据（provides），并保持父组件的实例来继承数据。

需要注意的一点是，provide 有两个入口点。一个是在组件的 setup 期间，这很容易想象，  
另一个是在 App 上调用 provide 时。

```ts
const app = createApp({
  setup() {
    //.
    //.
    //.
    provide('key', someValue) // 这是从组件调用 provide 的情况
    //.
    //.
  },
})

app.provide('key2', someValue2) // 在 App 上提供
```

现在，我们应该在哪里存储 app 提供的内容？由于 app 不是组件，这是一个问题。

为了给你答案，让我们说 app 实例有一个名为 AppContext 的对象，我们将在其中存储 provides 对象。

将来，我们将向这个 AppContext 添加全局组件和自定义指令设置。

现在我们已经解释了到目前为止的一切，让我们实现代码，使其按以下方式工作！

※ 假设的签名

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

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/40_basic_component_system/020_provide_inject)
