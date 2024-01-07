# computed / watch api

::: warning
[Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) was released at the end of December 2023, which includes [performance improvements for reactivity](https://github.com/vuejs/core/pull/5912).  
You should note that this online book is referencing the previous implementation.  
We plan to update this online book at the appropriate time.
:::

## Review of computed (and implementation)

In the previous chapter, we implemented the ref-related APIs. Next, let's talk about computed.
https://vuejs.org/api/reactivity-core.html#computed

Computed has two signatures: read-only and writable.

```ts
// read-only
function computed<T>(
  getter: () => T,
  // see "Computed Debugging" link below
  debuggerOptions?: DebuggerOptions,
): Readonly<Ref<Readonly<T>>>

// writable
function computed<T>(
  options: {
    get: () => T
    set: (value: T) => void
  },
  debuggerOptions?: DebuggerOptions,
): Ref<T>
```

The official implementation is a bit complex, but let's start with a simple structure.

The simplest way to implement it is to trigger the callback every time the value is retrieved.

```ts
export class ComputedRefImpl<T> {
  constructor(private getter: ComputedGetter<T>) {}

  get value() {
    return this.getter()
  }

  set value() {}
}
```

However, this is not really computed. It's just calling a function (which is not very exciting).

In reality, we want to track dependencies and recalculate when the value changes.

To achieve this, we use a mechanism where we update the `_dirty` flag as a scheduler job.
The `_dirty` flag is a flag that represents whether the value needs to be recalculated or not. It is updated when triggered by a dependency.

Here's an example of how it works:

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

Computed actually has a lazy evaluation nature, so the value is only recalculated when it is read for the first time.
We update this flag to true and the function is triggered by multiple dependencies, so we register it as the scheduler of ReactiveEffect.

This is the basic flow. When implementing, there are a few points to note, so let's summarize them below.

- When updating the `_dirty` flag to true, trigger the dependencies it has.
  ```ts
  if (!this._dirty) {
    this._dirty = true
    triggerRefValue(this)
  }
  ```
- Since computed is classified as `ref`, mark `__v_isRef` as true.
- If you want to implement a setter, implement it last. First, aim to make it computable.

Now that we are ready, let's implement it! If the code below works as expected, it's OK! (Please make sure that only the computed dependencies are triggered!)

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

Source code up to this point:
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/050_computed)
(with setter):
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/060_computed_setter)

## Implementation of Watch

https://vuejs.org/api/reactivity-core.html#watch

There are various forms of the watch API. Let's start by implementing the simplest form, which watches using a getter function.
First, let's aim for the code below to work.

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

The implementation of watch is not in reactivity, but in runtime-core (apiWatch.ts).

It may look a bit complex because there are various APIs mixed together, but it's actually quite simple if you narrow down the scope.
I have already implemented the signature of the target API (watch function) below, so please try implementing it. I believe you can do it if you have acquired the knowledge of reactivity so far!

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

Source code up to this point:
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/070_watch)

## Other APIs of watch

Once you have the base, it's just a matter of extending it. There is no need for further explanation.

- Watching ref
  ```ts
  const count = ref(0)
  watch(count, () => {
    /** some effects */
  })
  ```
- Watching multiple sources

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

- Reactive object

  ```ts
  const state = reactive({ count: 0 })
  watch(state, () => {
    /** some effects */
  }) // automatically in deep mode
  ```

Source code up to this point:
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/080_watch_api_extends)

## watchEffect

https://vuejs.org/api/reactivity-core.html#watcheffect

Implementing watchEffect is easy using the watch implementation.

```ts
const count = ref(0)

watchEffect(() => console.log(count.value))
// -> logs 0

count.value++
// -> logs 1
```

You can implement it like immediate for the image.

Source code so far:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/090_watch_effect)

---

※ Cleanup will be done in a separate chapter.
