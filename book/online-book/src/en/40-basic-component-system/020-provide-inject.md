# Implementation of Provide/Inject

## Let's implement Provide/Inject

This is the implementation of Provide and Inject. The implementation is quite simple as well.  
The basic concept is to have a place in ComponentInternalInstance to store the provided data (provides) and to keep the instance of the parent component to inherit the data.

One thing to note is that there are two entry points for provide. One is during the setup of the component, which is easy to imagine,  
and the other is when calling provide on the App.

```ts
const app = createApp({
  setup() {
    //.
    //.
    //.
    provide('key', someValue) // This is a case where provide is called from the component
    //.
    //.
  },
})

app.provide('key2', someValue2) // Provide on the App
```

Now, where should we store what was provided by app? Since app is not a component, it's a problem.

To give you the answer, let's say that the app instance has an object called AppContext and we will store the provides object in it.

In the future, we will add global component and custom directive settings to this AppContext.

Now that we have explained everything so far, let's implement the code so that it works as follows!

※ Assumed signatures

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

Source code so far:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/020_provide_inject)
