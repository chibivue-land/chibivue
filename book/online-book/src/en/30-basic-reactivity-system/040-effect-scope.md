# Effect Cleanup and Effect Scope

::: warning
[Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) was released at the end of December 2023, which includes [performance improvements for reactivity](https://github.com/vuejs/core/pull/5912).  
You should note that this online book is referencing the previous implementation.  
We plan to update this online book at the appropriate time.
:::

## Cleanup of ReactiveEffect

We haven't been cleaning up the effects we registered so far. Let's add cleanup processing to ReactiveEffect.

Implement a method called `stop` in ReactiveEffect.  
Add a flag to ReactiveEffect to indicate whether it is active or not, and in the `stop` method, switch it to `false` while removing the dependencies.

```ts
export class ReactiveEffect<T = any> {
  active = true // Added
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

With this basic implementation, all we need to do is remove all the dependencies when the `stop` method is executed.  
Additionally, let's add an implementation of hooks that allows us to register the processing we want to perform during cleanup, and handling when `activeEffect` is itself.

```ts
export class ReactiveEffect<T = any> {
  private deferStop?: boolean // Added
  onStop?: () => void // Added
  parent: ReactiveEffect | undefined = undefined // Added (to be referenced in finally)

  run() {
    if (!this.active) {
      return this.fn() // If active is false, simply execute the function
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
      // If activeEffect is itself, set a flag to stop after run is finished
      this.deferStop = true
    } else if (this.active) {
      // ...
      if (this.onStop) {
        this.onStop() // Execute registered hooks
      }
      // ...
    }
  }
}
```

Now that we have added cleanup processing to ReactiveEffect, let's also implement the cleanup function for watch.

If the following code works, it's OK.

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

Source code so far:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/130_cleanup_effects)

## What is Effect Scope

Now that we can clean up effects, we want to clean up unnecessary effects when a component is unmounted. However, it is a bit cumbersome to collect a large number of effects, whether it's watch or computed. If we try to implement it straightforwardly, it will look like this:

```ts
let disposables = []

const counter = ref(0)

const doubled = computed(() => counter.value * 2)
disposables.push(() => stop(doubled.effect))

const stopWatch = watchEffect(() => console.log(`counter: ${counter.value}`))
disposables.push(stopWatch)
```

```ts
// cleanup effects
disposables.forEach(f => f())
disposables = []
```

This kind of management is cumbersome and prone to mistakes.

Therefore, Vue has a mechanism called EffectScope.  
https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md

The idea is to have one EffectScope per instance, and specifically, it has the following interface:

```ts
const scope = effectScope()

scope.run(() => {
  const doubled = computed(() => counter.value * 2)

  watch(doubled, () => console.log(doubled.value))

  watchEffect(() => console.log('Count: ', doubled.value))
})

// to dispose all effects in the scope
scope.stop()
```

Quoted from: https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md#basic-example

And this EffectScope is also exposed as a user-facing API.  
https://v3.vuejs.org/api/reactivity-advanced.html#effectscope

## Implementation of EffectScope

As mentioned earlier, we will have one EffectScope per instance.

```ts
export interface ComponentInternalInstance {
  scope: EffectScope
}
```

And when the component is unmounted, we stop the collected effects.

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

The structure of EffectScope is as follows: it has a variable called `activeEffectScope` that points to the currently active EffectScope, and it manages its state with the `on/off/run/stop` methods implemented in EffectScope.  
The `on/off` methods lift themselves as `activeEffectScope` or restore the lifted state (return to the original EffectScope).  
And when a ReactiveEffect is created, it is registered in `activeEffectScope`.

Since it may be a little difficult to understand, if we write the image in source code,

```ts
instance.scope.on()

/** Some ReactiveEffect such as computed or watch is created */
setup()

instance.scope.off()
```

With this, we can collect the generated effects in the EffectScope of the instance.  
Then, when the `stop` method of this effect is triggered, we can clean up all the effects.

You should have understood the basic principles, so let's try implementing it while reading the source code!

Source code so far:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/140_effect_scope)
