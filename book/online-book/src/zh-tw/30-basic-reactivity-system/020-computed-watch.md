# computed / watch api

::: warning
這裡解釋的實現基於當前草擬的[響應式優化](/zh-tw/30-basic-reactivity-system/005-reactivity-optimization)之前的版本．  
一旦[響應式優化](/zh-tw/30-basic-reactivity-system/005-reactivity-optimization)完成，本章的內容將更新以與其保持一致．
:::

## computed 的回顧（和實現）

在上一章中，我們實現了與 ref 相關的 API．接下來，讓我們談談 computed．
https://vuejs.org/api/reactivity-core.html#computed

Computed 有兩個簽名：唯讀和可寫．

```ts
// 唯讀
function computed<T>(
  getter: () => T,
  // 參見下面的"Computed 除錯"連結
  debuggerOptions?: DebuggerOptions,
): Readonly<Ref<Readonly<T>>>

// 可寫
function computed<T>(
  options: {
    get: () => T
    set: (value: T) => void
  },
  debuggerOptions?: DebuggerOptions,
): Ref<T>
```

官方實現有點複雜，但讓我們從一個簡單的結構開始．

實現它的最簡單方法是每次檢索值時觸發回呼．

```ts
export class ComputedRefImpl<T> {
  constructor(private getter: ComputedGetter<T>) {}

  get value() {
    return this.getter()
  }

  set value() {}
}
```

然而，這並不是真正的 computed．它只是呼叫一個函式（這並不是很令人興奮）．

實際上，我們希望追蹤依賴項並在值更改時重新計算．

為了實現這一點，我們使用一種機制，將 `_dirty` 標誌作為調度器作業更新．
`_dirty` 標誌是一個表示值是否需要重新計算的標誌．它在被依賴項觸發時更新．

以下是它的工作原理示例：

```ts
export class ComputedRefImpl<T> {
  public dep?: Dep = undefined
  private _value!: T
  public readonly effect: ReactiveEffect<T>
  public _dirty = true

  constructor(getter: ComputedGetter<T>) {
    this.effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true
      }
    })
  }

  get value() {
    trackRefValue(this)
    if (this._dirty) {
      this._dirty = false
      this._value = this.effect.run()
    }
    return this._value
  }
}
```

Computed 實際上具有惰性求值的性質，所以值只在第一次讀取時重新計算．
我們將此標誌更新為 true，函式被多個依賴項觸發，所以我們將其註冊為 ReactiveEffect 的調度器．

這是基本流程．在實現時，有幾個要注意的點，讓我們在下面總結它們．

- 當將 `_dirty` 標誌更新為 true 時，觸發它擁有的依賴項．
  ```ts
  if (!this._dirty) {
    this._dirty = true
    triggerRefValue(this)
  }
  ```
- 由於 computed 被歸類為 `ref`，將 `__v_isRef` 標記為 true．
- 如果你想實現 setter，最後實現它．首先，目標是使其可計算．

現在我們準備好了，讓我們實現它！如果下面的程式碼按預期工作，就可以了！（請確保只觸發 computed 依賴項！）

```ts
import { computed, createApp, h, reactive, ref } from 'chibivue'

const app = createApp({
  setup() {
    const count = reactive({ value: 0 })
    const count2 = reactive({ value: 0 })
    const double = computed(() => {
      console.log('computed')
      return count.value * 2
    })
    const doubleDouble = computed(() => {
      console.log('computed (doubleDouble)')
      return double.value * 2
    })

    const countRef = ref(0)
    const doubleCountRef = computed(() => {
      console.log('computed (doubleCountRef)')
      return countRef.value * 2
    })

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${count.value}`]),
        h('p', {}, [`count2: ${count2.value}`]),
        h('p', {}, [`double: ${double.value}`]),
        h('p', {}, [`doubleDouble: ${doubleDouble.value}`]),
        h('p', {}, [`doubleCountRef: ${doubleCountRef.value}`]),
        h('button', { onClick: () => count.value++ }, ['update count']),
        h('button', { onClick: () => count2.value++ }, ['update count2']),
        h('button', { onClick: () => countRef.value++ }, ['update countRef']),
      ])
  },
})

app.mount('#app')
```

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/050_computed)
（帶 setter）：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/060_computed_setter)

## Watch 的實現

https://vuejs.org/api/reactivity-core.html#watch

watch API 有各種形式．讓我們從實現最簡單的形式開始，即使用 getter 函式進行監視．
首先，讓我們目標使下面的程式碼工作．

```ts
import { createApp, h, reactive, watch } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    watch(
      () => state.count,
      () => alert('state.count was changed!'),
    )

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: () => state.count++ }, ['update state']),
      ])
  },
})

app.mount('#app')
```

watch 的實現不在 reactivity 中，而在 runtime-core（apiWatch.ts）中．

它可能看起來有點複雜，因為有各種 API 混合在一起，但如果你縮小範圍，實際上非常簡單．
我已經在下面實現了目標 API（watch 函式）的簽名，所以請嘗試實現它．我相信如果你到目前為止已經掌握了響應式的知識，你可以做到！

```ts
export type WatchEffect = (onCleanup: OnCleanup) => void

export type WatchSource<T = any> = () => T

type OnCleanup = (cleanupFn: () => void) => void

export function watch<T>(
  source: WatchSource<T>,
  cb: (newValue: T, oldValue: T) => void,
) {
  // TODO:
}
```

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/070_watch)

## watch 的其他 API

一旦你有了基礎，就只是擴展的問題．不需要進一步解釋．

- 監視 ref
  ```ts
  const count = ref(0)
  watch(count, () => {
    /** some effects */
  })
  ```
- 監視多個源

  ```ts
  const count = ref(0)
  const count2 = ref(0)
  const count3 = ref(0)
  watch([count, count2, count3], () => {
    /** some effects */
  })
  ```

- Immediate

  ```ts
  const count = ref(0)
  watch(
    count,
    () => {
      /** some effects */
    },
    { immediate: true },
  )
  ```

- Deep

  ```ts
  const state = reactive({ count: 0 })
  watch(
    () => state,
    () => {
      /** some effects */
    },
    { deep: true },
  )
  ```

- 響應式物件

  ```ts
  const state = reactive({ count: 0 })
  watch(state, () => {
    /** some effects */
  }) // 自動進入深度模式
  ```

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/080_watch_api_extends)

## watchEffect

https://vuejs.org/api/reactivity-core.html#watcheffect

使用 watch 實現來實現 watchEffect 很容易．

```ts
const count = ref(0)

watchEffect(() => console.log(count.value))
// -> 記錄 0

count.value++
// -> 記錄 1
```

你可以像 immediate 的圖像一樣實現它．

到此為止的原始碼：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/090_watch_effect)

---

※ 清理將在單獨的章節中完成．
