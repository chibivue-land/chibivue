# ref api (Basic Reactivity System Start)

::: warning
[Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) was released at the end of December 2023, which includes [performance improvements for reactivity](https://github.com/vuejs/core/pull/5912).  
You should note that this online book is referencing the previous implementation.  
We plan to update this online book at the appropriate time.
:::

## Review of ref api (and implementation)

Vue.js has various APIs related to reactivity, and among them, ref is particularly famous.  
Even in the official documentation, it is introduced as the first topic under the name "Reactivity Core".  
https://vuejs.org/api/reactivity-core.html#ref

So, what is ref API?
According to the official documentation,

> The ref object is mutable - i.e. you can assign new values to .value. It is also reactive - i.e. any read operations to .value are tracked, and write operations will trigger associated effects.

> If an object is assigned as a ref's value, the object is made deeply reactive with reactive(). This also means if the object contains nested refs, they will be deeply unwrapped.

(Quote: https://vuejs.org/api/reactivity-core.html#ref)

In short, the ref object has two characteristics:

- Get/set operations on the value property trigger track/trigger.
- When an object is assigned to the value property, the value property becomes a reactive object.

To explain it in code,

```ts
const count = ref(0)
count.value++ // effect (characteristic 1)

const state = ref({ count: 0 })
state.value = { count: 1 } // effect (characteristic 1)
state.value.count++ // effect (characteristic 2)
```

That's what it means.

Until you can distinguish between ref and reactive, you may confuse the distinction between `ref(0)` and `reactive({ value: 0 })`, but considering the two characteristics mentioned above, you can see that they have completely different meanings.
ref does not generate a reactive object like `{ value: x }`. The track/trigger for get/set operations on the value is performed by the implementation of ref, and if the part corresponding to x is an object, it becomes a reactive object.

In terms of implementation, it looks like this:

```ts
class RefImpl<T> {
  private _value: T
  public dep?: Dep = undefined

  get value() {
    trackRefValue(this)
  }

  set value(newVal) {
    this._value = toReactive(v)
    triggerRefValue(this)
  }
}

const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value
```

Let's implement ref while looking at the source code!
There are various functions and classes, but for now, it would be sufficient to focus on the RefImpl class and the ref function.

Once you can run the following source code, it's OK!
(Note: The template compiler needs to support ref separately, so it won't work)

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const count = ref(0)

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${count.value}`]),
        h('button', { onClick: () => count.value++ }, ['Increment']),
      ])
  },
})

app.mount('#app')
```

Source code up to this point:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/010_ref)

## shallowRef

Now, let's continue implementing more ref-related APIs.  
As mentioned earlier, one of the characteristics of ref is that "when an object is assigned to the value property, the value property becomes a reactive object". shallowRef does not have this characteristic.

> Unlike ref(), the inner value of a shallow ref is stored and exposed as-is, and will not be made deeply reactive. Only the .value access is reactive.

(Quote: https://vuejs.org/api/reactivity-advanced.html#shallowref)

The task is very simple. We can use the implementation of RefImpl as it is and skip the part of `toReactive`.  
Let's implement it while reading the source code!

Once you can run the following source code, it's OK!

```ts
import { createApp, h, shallowRef } from 'chibivue'

const app = createApp({
  setup() {
    const state = shallowRef({ count: 0 })

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.value.count}`]),

        h(
          'button',
          {
            onClick: () => {
              state.value = { count: state.value.count + 1 }
            },
          },
          ['increment'],
        ),

        h(
          'button', // Clicking does not trigger re-rendering
          {
            onClick: () => {
              state.value.count++
            },
          },
          ['not trigger ...'],
        ),
      ])
  },
})

app.mount('#app')
```

### triggerRef

As mentioned earlier, since the value of shallow ref is not a reactive object, changes to it will not trigger effects.  
However, the value itself is an object, so it has been changed.  
Therefore, there is an API to forcefully trigger effects. It is triggerRef.

https://vuejs.org/api/reactivity-advanced.html#triggerref

```ts
import { createApp, h, shallowRef, triggerRef } from 'chibivue'

const app = createApp({
  setup() {
    const state = shallowRef({ count: 0 })
    const forceUpdate = () => {
      triggerRef(state)
    }

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.value.count}`]),

        h(
          'button',
          {
            onClick: () => {
              state.value = { count: state.value.count + 1 }
            },
          },
          ['increment'],
        ),

        h(
          'button', // Clicking does not trigger re-rendering
          {
            onClick: () => {
              state.value.count++
            },
          },
          ['not trigger ...'],
        ),

        h(
          'button', // The rendering is updated to the value currently held by state.value.count
          { onClick: forceUpdate },
          ['force update !'],
        ),
      ])
  },
})

app.mount('#app')
```

Source code up to this point:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/020_shallow_ref)

## toRef

toRef is an API that generates a ref to a property of a reactive object.

https://vuejs.org/api/reactivity-utilities.html#toref

It is often used to convert specific properties of props into refs.

```ts
const count = toRef(props, 'count')
console.log(count.value)
```

The ref created by toRef is synchronized with the original reactive object.
If you make changes to this ref, the original reactive object will also be updated, and if there are any changes to the original reactive object, this ref will also be updated.

```ts
import { createApp, h, reactive, toRef } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const stateCountRef = toRef(state, 'count')

    return () =>
      h('div', {}, [
        h('p', {}, [`state.count: ${state.count}`]),
        h('p', {}, [`stateCountRef.value: ${stateCountRef.value}`]),
        h('button', { onClick: () => state.count++ }, ['updateState']),
        h('button', { onClick: () => stateCountRef.value++ }, ['updateRef']),
      ])
  },
})

app.mount('#app')
```

Let's implement while reading the source code!

※ From v3.3, the normalization feature has been added to toRef. chibivue does not implement this feature.  
Please check the signature in the official documentation for more details! (https://vuejs.org/api/reactivity-utilities.html#toref)

Source code so far:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/030_to_ref)

## toRefs

Generates refs for all properties of a reactive object.

https://vuejs.org/api/reactivity-utilities.html#torefs

```ts
import { createApp, h, reactive, toRefs } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ foo: 1, bar: 2 })
    const stateAsRefs = toRefs(state)

    return () =>
      h('div', {}, [
        h('p', {}, [`[state]: foo: ${state.foo}, bar: ${state.bar}`]),
        h('p', {}, [
          `[stateAsRefs]: foo: ${stateAsRefs.foo.value}, bar: ${stateAsRefs.bar.value}`,
        ]),
        h('button', { onClick: () => state.foo++ }, ['update state.foo']),
        h('button', { onClick: () => stateAsRefs.bar.value++ }, [
          'update stateAsRefs.bar.value',
        ]),
      ])
  },
})

app.mount('#app')
```

This can be easily implemented using the implementation of toRef.

Source code so far:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/040_to_refs)
