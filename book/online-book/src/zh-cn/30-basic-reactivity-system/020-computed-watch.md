# computed / watch api

::: warning
这里解释的实现基于当前草拟的[响应式优化](/zh-cn/30-basic-reactivity-system/005-reactivity-optimization)之前的版本。  
一旦[响应式优化](/zh-cn/30-basic-reactivity-system/005-reactivity-optimization)完成，本章的内容将更新以与其保持一致。
:::

## computed 的回顾（和实现）

在上一章中，我们实现了与 ref 相关的 API。接下来，让我们谈谈 computed。
https://vuejs.org/api/reactivity-core.html#computed

Computed 有两个签名：只读和可写。

```ts
// 只读
function computed<T>(
  getter: () => T,
  // 参见下面的"Computed 调试"链接
  debuggerOptions?: DebuggerOptions,
): Readonly<Ref<Readonly<T>>>

// 可写
function computed<T>(
  options: {
    get: () => T
    set: (value: T) => void
  },
  debuggerOptions?: DebuggerOptions,
): Ref<T>
```

官方实现有点复杂，但让我们从一个简单的结构开始。

实现它的最简单方法是每次检索值时触发回调。

```ts
export class ComputedRefImpl<T> {
  constructor(private getter: ComputedGetter<T>) {}

  get value() {
    return this.getter()
  }

  set value() {}
}
```

然而，这并不是真正的 computed。它只是调用一个函数（这并不是很令人兴奋）。

实际上，我们希望跟踪依赖项并在值更改时重新计算。

为了实现这一点，我们使用一种机制，将 `_dirty` 标志作为调度器作业更新。
`_dirty` 标志是一个表示值是否需要重新计算的标志。它在被依赖项触发时更新。

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

Computed 实际上具有惰性求值的性质，所以值只在第一次读取时重新计算。
我们将此标志更新为 true，函数被多个依赖项触发，所以我们将其注册为 ReactiveEffect 的调度器。

这是基本流程。在实现时，有几个要注意的点，让我们在下面总结它们。

- 当将 `_dirty` 标志更新为 true 时，触发它拥有的依赖项。
  ```ts
  if (!this._dirty) {
    this._dirty = true
    triggerRefValue(this)
  }
  ```
- 由于 computed 被归类为 `ref`，将 `__v_isRef` 标记为 true。
- 如果你想实现 setter，最后实现它。首先，目标是使其可计算。

现在我们准备好了，让我们实现它！如果下面的代码按预期工作，就可以了！（请确保只触发 computed 依赖项！）

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

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/050_computed)
（带 setter）：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/060_computed_setter)

## Watch 的实现

https://vuejs.org/api/reactivity-core.html#watch

watch API 有各种形式。让我们从实现最简单的形式开始，即使用 getter 函数进行监视。
首先，让我们目标使下面的代码工作。

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

watch 的实现不在 reactivity 中，而在 runtime-core（apiWatch.ts）中。

它可能看起来有点复杂，因为有各种 API 混合在一起，但如果你缩小范围，实际上非常简单。
我已经在下面实现了目标 API（watch 函数）的签名，所以请尝试实现它。我相信如果你到目前为止已经掌握了响应式的知识，你可以做到！

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

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/070_watch)

## watch 的其他 API

一旦你有了基础，就只是扩展的问题。不需要进一步解释。

- 监视 ref
  ```ts
  const count = ref(0)
  watch(count, () => {
    /** some effects */
  })
  ```
- 监视多个源

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

- 响应式对象

  ```ts
  const state = reactive({ count: 0 })
  watch(state, () => {
    /** some effects */
  }) // 自动进入深度模式
  ```

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/080_watch_api_extends)

## watchEffect

https://vuejs.org/api/reactivity-core.html#watcheffect

使用 watch 实现来实现 watchEffect 很容易。

```ts
const count = ref(0)

watchEffect(() => console.log(count.value))
// -> 记录 0

count.value++
// -> 记录 1
```

你可以像 immediate 的图像一样实现它。

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/090_watch_effect)

---

※ 清理将在单独的章节中完成。
