# ref api（基础响应式系统开始）

::: tip 前置知识
在阅读本章之前，我们建议阅读[响应式优化](/zh-cn/30-basic-reactivity-system/005-reactivity-optimization)以了解基于 alien-signals 的优化响应式系统的概念。
:::

## ref api 的回顾（和实现）

Vue.js 有各种与响应式相关的 API，其中 ref 特别著名．  
即使在官方文档中，它也作为"响应式核心"名称下的第一个主题被介绍．  
https://vuejs.org/api/reactivity-core.html#ref

那么，什么是 ref API？
根据官方文档，

> ref 对象是可变的 - 即你可以为 .value 分配新值。它也是响应式的 - 即对 .value 的任何读取操作都会被跟踪，写入操作会触发相关的 effect。

> 如果将对象分配为 ref 的值，该对象会通过 reactive() 变成深度响应式的。这也意味着如果对象包含嵌套的 ref，它们将被深度解包。

（引用：https://vuejs.org/api/reactivity-core.html#ref）

简而言之，ref 对象有两个特征：

- 对 value 属性的获取/设置操作会触发 track/trigger．
- 当对象被分配给 value 属性时，value 属性变成响应式对象．

用代码来解释，

```ts
const count = ref(0)
count.value++ // effect（特征 1）

const state = ref({ count: 0 })
state.value = { count: 1 } // effect（特征 1）
state.value.count++ // effect（特征 2）
```

就是这个意思．

在你能够区分 ref 和 reactive 之前，你可能会混淆 `ref(0)` 和 `reactive({ value: 0 })` 之间的区别，但考虑到上面提到的两个特征，你可以看到它们有完全不同的含义．
ref 不会生成像 `{ value: x }` 这样的响应式对象．对 value 的获取/设置操作的 track/trigger 是由 ref 的实现执行的，如果对应于 x 的部分是对象，它就会变成响应式对象．

在实现方面，它看起来像这样：

```ts
class RefImpl<T> {
  private _value: T
  public dep?: Dep = undefined

  get value() {
    trackRefValue(this)
  }

  set value(newVal) {
    this._value = toReactive(newVal)
    triggerRefValue(this)
  }
}

const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value
```

让我们在查看源代码的同时实现 ref！
有各种函数和类，但现在，专注于 RefImpl 类和 ref 函数就足够了．

一旦你能运行以下源代码，就可以了！
（注意：模板编译器需要单独支持 ref，所以它不会工作）

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

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/010_ref)

## shallowRef

现在，让我们继续实现更多与 ref 相关的 API．  
如前所述，ref 的特征之一是"当对象被分配给 value 属性时，value 属性变成响应式对象"．shallowRef 没有这个特征．

> 与 ref() 不同，浅层 ref 的内部值按原样存储和暴露，不会被深度响应式化。只有 .value 访问是响应式的。

（引用：https://vuejs.org/api/reactivity-advanced.html#shallowref）

任务非常简单．我们可以按原样使用 RefImpl 的实现，并跳过 `toReactive` 部分．  
让我们在阅读源代码的同时实现它！

一旦你能运行以下源代码，就可以了！

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
          'button', // 点击不会触发重新渲染
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

如前所述，由于 shallow ref 的值不是响应式对象，对它的更改不会触发 effect．  
然而，值本身是一个对象，所以它已经被更改了．  
因此，有一个 API 可以强制触发 effect．它就是 triggerRef．

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
          'button', // 点击不会触发重新渲染
          {
            onClick: () => {
              state.value.count++
            },
          },
          ['not trigger ...'],
        ),

        h(
          'button', // 渲染更新为 state.value.count 当前持有的值
          { onClick: forceUpdate },
          ['force update !'],
        ),
      ])
  },
})

app.mount('#app')
```

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/020_shallow_ref)

## toRef

toRef 是一个为响应式对象的属性生成 ref 的 API．

https://vuejs.org/api/reactivity-utilities.html#toref

它经常用于将 props 的特定属性转换为 ref．

```ts
const count = toRef(props, 'count')
console.log(count.value)
```

由 toRef 创建的 ref 与原始响应式对象同步．
如果你对这个 ref 进行更改，原始响应式对象也会被更新，如果原始响应式对象有任何更改，这个 ref 也会被更新．

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

让我们在阅读源代码的同时实现！

※ 从 v3.3 开始，toRef 添加了规范化功能．chibivue 不实现此功能．  
请查看官方文档中的签名以获取更多详细信息！（https://vuejs.org/api/reactivity-utilities.html#toref）

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/030_to_ref)

## toRefs

为响应式对象的所有属性生成 ref．

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

这可以使用 toRef 的实现轻松实现．

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/040_to_refs)
