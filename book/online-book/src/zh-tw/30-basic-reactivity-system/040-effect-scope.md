# Effect 清理和 Effect 作用域

::: warning
這裡解釋的實現基於當前草擬的[響應式優化](/zh-tw/30-basic-reactivity-system/005-reactivity-optimization)之前的版本．  
一旦[響應式優化](/zh-tw/30-basic-reactivity-system/005-reactivity-optimization)完成，本章的內容將更新以與其保持一致．
:::

## ReactiveEffect 的清理

到目前為止，我們還沒有清理註冊的 effect．讓我們為 ReactiveEffect 添加清理處理．

在 ReactiveEffect 中實現一個名為 `stop` 的方法．  
為 ReactiveEffect 添加一個標誌來指示它是否處於活動狀態，在 `stop` 方法中，將其切換為 `false` 同時刪除依賴項．

```ts
export class ReactiveEffect<T = any> {
  active = true // 添加
  //.
  //.
  //.
  stop() {
    if (this.active) {
      this.active = false
    }
  }
}
```

有了這個基本實現，我們需要做的就是在執行 `stop` 方法時刪除所有依賴項．  
此外，讓我們添加鉤子的實現，允許我們註冊在清理期間要執行的處理，以及當 `activeEffect` 是自身時的處理．

```ts
export class ReactiveEffect<T = any> {
  private deferStop?: boolean // 添加
  onStop?: () => void // 添加
  parent: ReactiveEffect | undefined = undefined // 添加（在 finally 中引用）

  run() {
    if (!this.active) {
      return this.fn() // 如果 active 為 false，簡單地執行函式
    }

    try {
      this.parent = activeEffect
      activeEffect = this
      const res = this.fn()
      return res
    } finally {
      activeEffect = this.parent
      this.parent = undefined
      if (this.deferStop) {
        this.stop()
      }
    }
  }

  stop() {
    if (activeEffect === this) {
      // 如果 activeEffect 是自身，設置標誌在 run 完成後停止
      this.deferStop = true
    } else if (this.active) {
      // ...
      if (this.onStop) {
        this.onStop() // 執行註冊的鉤子
      }
      // ...
    }
  }
}
```

現在我們已經為 ReactiveEffect 添加了清理處理，讓我們也為 watch 實現清理函式．

如果以下程式碼工作，就可以了．

```ts
import { createApp, h, reactive, watch } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => {
      state.count++
    }

    const unwatch = watch(
      () => state.count,
      (newValue, oldValue, cleanup) => {
        alert(`New value: ${newValue}, old value: ${oldValue}`)
        cleanup(() => alert('Clean Up!'))
      },
    )

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, [`increment`]),
        h('button', { onClick: unwatch }, [`unwatch`]),
      ])
  },
})

app.mount('#app')
```

到此為止的原始碼：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/130_cleanup_effects)

## 什麼是 Effect 作用域

現在我們可以清理 effect，我們希望在組件卸載時清理不必要的 effect．然而，收集大量的 effect（無論是 watch 還是 computed）有點麻煩．如果我們嘗試直接實現它，它會看起來像這樣：

```ts
let disposables = []

const counter = ref(0)

const doubled = computed(() => counter.value * 2)
disposables.push(() => stop(doubled.effect))

const stopWatch = watchEffect(() => console.log(`counter: ${counter.value}`))
disposables.push(stopWatch)
```

```ts
// 清理 effect
disposables.forEach(f => f())
disposables = []
```

這種管理方式很麻煩且容易出錯．

因此，Vue 有一個稱為 EffectScope 的機制．  
https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md

想法是每個實例有一個 EffectScope，具體來說，它有以下介面：

```ts
const scope = effectScope()

scope.run(() => {
  const doubled = computed(() => counter.value * 2)

  watch(doubled, () => console.log(doubled.value))

  watchEffect(() => console.log('Count: ', doubled.value))
})

// 處理作用域中的所有 effect
scope.stop()
```

引用自：https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md#basic-example

這個 EffectScope 也作為面向使用者的 API 公開．  
https://v3.vuejs.org/api/reactivity-advanced.html#effectscope

## EffectScope 的實現

如前所述，我們將每個實例有一個 EffectScope．

```ts
export interface ComponentInternalInstance {
  scope: EffectScope
}
```

當組件卸載時，我們停止收集的 effect．

```ts
const unmountComponent = (...) => {
  // .
  // .
  const { scope } = instance;
  scope.stop();
  // .
  // .
}
```

EffectScope 的結構如下：它有一個名為 `activeEffectScope` 的變數，指向當前活動的 EffectScope，並使用在 EffectScope 中實現的 `on/off/run/stop` 方法管理其狀態．  
`on/off` 方法將自身提升為 `activeEffectScope` 或恢復提升狀態（返回到原始 EffectScope）．  
當創建 ReactiveEffect 時，它在 `activeEffectScope` 中註冊．

由於可能有點難以理解，如果我們在原始碼中寫出圖像，

```ts
instance.scope.on()

/** 創建一些 ReactiveEffect，如 computed 或 watch */
setup()

instance.scope.off()
```

透過這種方式，我們可以在實例的 EffectScope 中收集生成的 effect．  
然後，當觸發此 effect 的 `stop` 方法時，我們可以清理所有 effect．

你應該已經理解了基本原理，所以讓我們在閱讀原始碼的同時嘗試實現它！

到此為止的原始碼：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/140_effect_scope)
