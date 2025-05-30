# Effect 清理和 Effect 作用域

::: warning
这里解释的实现基于当前草拟的[响应式优化](/30-basic-reactivity-system/005-reactivity-optimization)之前的版本。  
一旦[响应式优化](/30-basic-reactivity-system/005-reactivity-optimization)完成，本章的内容将更新以与其保持一致。
:::

## ReactiveEffect 的清理

到目前为止，我们还没有清理注册的 effect。让我们为 ReactiveEffect 添加清理处理。

在 ReactiveEffect 中实现一个名为 `stop` 的方法。  
为 ReactiveEffect 添加一个标志来指示它是否处于活动状态，在 `stop` 方法中，将其切换为 `false` 同时删除依赖项。

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

有了这个基本实现，我们需要做的就是在执行 `stop` 方法时删除所有依赖项。  
此外，让我们添加钩子的实现，允许我们注册在清理期间要执行的处理，以及当 `activeEffect` 是自身时的处理。

```ts
export class ReactiveEffect<T = any> {
  private deferStop?: boolean // 添加
  onStop?: () => void // 添加
  parent: ReactiveEffect | undefined = undefined // 添加（在 finally 中引用）

  run() {
    if (!this.active) {
      return this.fn() // 如果 active 为 false，简单地执行函数
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
      // 如果 activeEffect 是自身，设置标志在 run 完成后停止
      this.deferStop = true
    } else if (this.active) {
      // ...
      if (this.onStop) {
        this.onStop() // 执行注册的钩子
      }
      // ...
    }
  }
}
```

现在我们已经为 ReactiveEffect 添加了清理处理，让我们也为 watch 实现清理函数。

如果以下代码工作，就可以了。

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

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/130_cleanup_effects)

## 什么是 Effect 作用域

现在我们可以清理 effect，我们希望在组件卸载时清理不必要的 effect。然而，收集大量的 effect（无论是 watch 还是 computed）有点麻烦。如果我们尝试直接实现它，它会看起来像这样：

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

这种管理方式很麻烦且容易出错。

因此，Vue 有一个称为 EffectScope 的机制。  
https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md

想法是每个实例有一个 EffectScope，具体来说，它有以下接口：

```ts
const scope = effectScope()

scope.run(() => {
  const doubled = computed(() => counter.value * 2)

  watch(doubled, () => console.log(doubled.value))

  watchEffect(() => console.log('Count: ', doubled.value))
})

// 处理作用域中的所有 effect
scope.stop()
```

引用自：https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md#basic-example

这个 EffectScope 也作为面向用户的 API 公开。  
https://v3.vuejs.org/api/reactivity-advanced.html#effectscope

## EffectScope 的实现

如前所述，我们将每个实例有一个 EffectScope。

```ts
export interface ComponentInternalInstance {
  scope: EffectScope
}
```

当组件卸载时，我们停止收集的 effect。

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

EffectScope 的结构如下：它有一个名为 `activeEffectScope` 的变量，指向当前活动的 EffectScope，并使用在 EffectScope 中实现的 `on/off/run/stop` 方法管理其状态。  
`on/off` 方法将自身提升为 `activeEffectScope` 或恢复提升状态（返回到原始 EffectScope）。  
当创建 ReactiveEffect 时，它在 `activeEffectScope` 中注册。

由于可能有点难以理解，如果我们在源代码中写出图像，

```ts
instance.scope.on()

/** 创建一些 ReactiveEffect，如 computed 或 watch */
setup()

instance.scope.off()
```

通过这种方式，我们可以在实例的 EffectScope 中收集生成的 effect。  
然后，当触发此 effect 的 `stop` 方法时，我们可以清理所有 effect。

你应该已经理解了基本原理，所以让我们在阅读源代码的同时尝试实现它！

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/140_effect_scope)
