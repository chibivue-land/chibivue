# 各种响应式代理处理器

::: warning
这里解释的实现基于当前草拟的[响应式优化](/zh-cn/30-basic-reactivity-system/005-reactivity-optimization)之前的版本．  
一旦[响应式优化](/zh-cn/30-basic-reactivity-system/005-reactivity-optimization)完成，本章的内容将更新以与其保持一致．
:::

## 不应该是响应式的对象

现在，让我们解决当前响应式系统的一个问题．  
首先，尝试运行以下代码．

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null)
    const getRef = () => {
      inputRef.value = document.getElementById(
        'my-input',
      ) as HTMLInputElement | null
      console.log(inputRef.value)
    }

    return () =>
      h('div', {}, [
        h('input', { id: 'my-input' }, []),
        h('button', { onClick: getRef }, ['getRef']),
      ])
  },
})

app.mount('#app')
```

如果你检查控制台，你应该看到以下结果：

![reactive_html_element](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/reactive_html_element.png)

现在，让我们添加一个焦点函数．

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null)
    const getRef = () => {
      inputRef.value = document.getElementById(
        'my-input',
      ) as HTMLInputElement | null
      console.log(inputRef.value)
    }
    const focus = () => {
      inputRef.value?.focus()
    }

    return () =>
      h('div', {}, [
        h('input', { id: 'my-input' }, []),
        h('button', { onClick: getRef }, ['getRef']),
        h('button', { onClick: focus }, ['focus']),
      ])
  },
})

app.mount('#app')
```

令人惊讶的是，它抛出了一个错误．

![focus_in_reactive_html_element](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/focus_in_reactive_html_element.png)

原因是 `document.getElementById` 获得的元素被用来生成 Proxy 本身．

当生成 Proxy 时，值变成 Proxy 而不是原始对象，导致 HTML 元素功能的丢失．

## 在生成响应式代理之前确定对象

确定方法非常简单．使用 `Object.prototype.toString`．
让我们看看 `Object.prototype.toString` 如何在上面的代码中确定 HTMLInputElement．

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null)
    const getRef = () => {
      inputRef.value = document.getElementById(
        'my-input',
      ) as HTMLInputElement | null
      console.log(inputRef.value?.toString())
    }
    const focus = () => {
      inputRef.value?.focus()
    }

    return () =>
      h('div', {}, [
        h('input', { id: 'my-input' }, []),
        h('button', { onClick: getRef }, ['getRef']),
        h('button', { onClick: focus }, ['focus']),
      ])
  },
})

app.mount('#app')
```

![element_to_string](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/element_to_string.png)

这允许我们确定对象的类型．虽然有些硬编码，但让我们概括这个确定函数．

```ts
// shared/general.ts
export const objectToString = Object.prototype.toString // 已在 isMap 和 isSet 中使用
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

// 这次要添加的函数
export const toRawType = (value: unknown): string => {
  return toTypeString(value).slice(8, -1)
}
```

使用 `slice` 的原因是获取 `[Object hoge]` 中对应于 `hoge` 的字符串．

然后，让我们通过使用 `reactive toRawType` 确定对象的类型并进行分支．
跳过为 HTMLInput 生成 Proxy．

在 reactive.ts 中，获取 rawType 并确定将成为 reactive 目标的对象类型．

```ts
const enum TargetType {
  INVALID = 0,
  COMMON = 1,
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    default:
      return TargetType.INVALID
  }
}

function getTargetType<T extends object>(value: T) {
  return !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}
```

```ts
export function reactive<T extends object>(target: T): T {
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target
  }

  const proxy = new Proxy(target, mutableHandlers)
  return proxy as T
}
```

现在，焦点代码应该工作了！

![focus_in_element](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/focus_in_element.png)

## 实现 TemplateRefs

现在我们可以将 HTML 元素放入 Ref 中，让我们实现 TemplateRef．

Ref 可以通过使用 ref 属性来引用模板．

https://vuejs.org/guide/essentials/template-refs.html

目标是使以下代码工作：

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null)
    const focus = () => {
      inputRef.value?.focus()
    }

    return () =>
      h('div', {}, [
        h('input', { ref: inputRef }, []),
        h('button', { onClick: focus }, ['focus']),
      ])
  },
})

app.mount('#app')
```

如果你已经走到这一步，你可能已经看到如何实现它．
是的，只需将 ref 添加到 VNode 并在渲染期间注入值．

```ts
export interface VNode<HostNode = any> {
  // .
  // .
  key: string | number | symbol | null
  ref: Ref | null // 这个
  // .
  // .
}
```

在原始实现中，它被称为 `setRef`．找到它，阅读它，并实现它！
在原始实现中，它更复杂，ref 是一个数组并且可以通过 `$ref` 访问，但现在，让我们目标使上面的代码工作．

顺便说一下，如果它是一个组件，将组件的 `setupContext` 分配给 ref．  
（注意：实际上，你应该传递组件的代理，但它还没有实现，所以我们现在使用 `setupContext`．）

```ts
import { createApp, h, ref } from 'chibivue'

const Child = {
  setup() {
    const action = () => alert('clicked!')
    return { action }
  },

  template: `<button @click="action">action (child)</button>`,
}

const app = createApp({
  setup() {
    const childRef = ref<any>(null)
    const childAction = () => {
      childRef.value?.action()
    }

    return () =>
      h('div', {}, [
        h('div', {}, [
          h(Child, { ref: childRef }, []),
          h('button', { onClick: childAction }, ['action (parent)']),
        ]),
      ])
  },
})

app.mount('#app')
```

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/110_template_refs)

## 处理具有变化键的对象

实际上，当前的实现无法处理具有变化键的对象．
这也包括数组．
换句话说，以下组件无法正常工作：

```ts
const App = {
  setup() {
    const array = ref<number[]>([])
    const mutateArray = () => {
      array.value.push(Date.now()) // 即使调用这个也不会触发 effect（set 的键是 "0"）
    }

    const record = reactive<Record<string, number>>({})
    const mutateRecord = () => {
      record[Date.now().toString()] = Date.now() // 即使键改变也不会触发 effect
    }

    return () =>
      h('div', {}, [
        h('p', {}, [`array: ${JSON.stringify(array.value)}`]),
        h('button', { onClick: mutateArray }, ['update array']),

        h('p', {}, [`record: ${JSON.stringify(record)}`]),
        h('button', { onClick: mutateRecord }, ['update record']),
      ])
  },
}
```

我们如何解决这个问题？

### 对于数组

数组本质上是对象，所以当添加新元素时，其索引作为键传递给 Proxy 的 `set` 处理器．

```ts
const p = new Proxy([], {
  set(target, key, value, receiver) {
    console.log(key) // ※
    Reflect.set(target, key, value, receiver)
    return true
  },
})

p.push(42) // 0
```

然而，我们无法单独跟踪这些键中的每一个．
因此，我们可以跟踪数组的 `length` 来触发数组的变化．

值得注意的是，`length` 已经被跟踪了．

如果你在浏览器或类似环境中执行以下代码，你会看到当使用 `JSON.stringify` 字符串化数组时会调用 `length`．

```ts
const data = new Proxy([], {
  get(target, key) {
    console.log('get!', key)
    return Reflect.get(target, key)
  },
})

JSON.stringify(data)
// get! length
// get! toJSON
```

换句话说，`length` 已经注册了一个 effect．所以，我们需要做的就是提取这个 effect 并在设置索引时触发它．

如果键被确定为索引，我们触发 `length` 的 effect．
当然，可能还有其他依赖项，所以我们将它们提取到一个名为 `deps` 的数组中并一起触发 effect．

```ts
export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  let deps: (Dep | undefined)[] = []
  if (key !== void 0) {
    deps.push(depsMap.get(key))
  }

  // 这个
  if (isIntegerKey(key)) {
    deps.push(depsMap.get('length'))
  }

  for (const dep of deps) {
    if (dep) {
      triggerEffects(dep)
    }
  }
}
```

```ts
// shared/general.ts
export const isIntegerKey = (key: unknown) =>
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  '' + parseInt(key, 10) === key
```

现在，数组应该正常工作了．

### 对于对象（记录）

接下来，让我们考虑对象．与数组不同，对象没有 `length` 属性．

我们可以在这里做一个小修改．
我们可以准备一个名为 `ITERATE_KEY` 的符号，并以类似于数组的 `length` 属性的方式使用它．
你可能不理解我的意思，但由于 `depsMap` 只是一个 Map，使用我们定义的符号作为键没有问题．

操作顺序与数组略有不同，但让我们从考虑 `trigger` 函数开始．
我们可以实现它，就好像有一个注册了 effect 的 `ITERATE_KEY`．

```ts
export const ITERATE_KEY = Symbol()

export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  let deps: (Dep | undefined)[] = []
  if (key !== void 0) {
    deps.push(depsMap.get(key))
  }

  if (!isArray(target)) {
    // 如果不是数组，触发用 ITERATE_KEY 注册的 effect
    deps.push(depsMap.get(ITERATE_KEY))
  } else if (isIntegerKey(key)) {
    // 向数组添加新索引 -> length 改变
    deps.push(depsMap.get('length'))
  }

  for (const dep of deps) {
    if (dep) {
      triggerEffects(dep)
    }
  }
}
```

问题是如何跟踪 `ITERATE_KEY` 的 effect．

在这里，我们可以使用 `ownKeys` Proxy 处理器．

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/ownKeys

`ownKeys` 被 `Object.keys()` 或 `Reflect.ownKeys()` 等函数调用，但它也被 `JSON.stringify` 调用．

你可以通过在浏览器或类似环境中运行以下代码来确认这一点：

```ts
const data = new Proxy(
  {},
  {
    get(target, key) {
      return Reflect.get(target, key)
    },
    ownKeys(target) {
      console.log('ownKeys!!!')
      return Reflect.ownKeys(target)
    },
  },
)

JSON.stringify(data)
```

我们可以使用这个来跟踪 `ITERATE_KEY`．
对于数组，我们不需要它，所以我们可以简单地跟踪 `length`．

```ts
export const mutableHandlers: ProxyHandler<object> = {
  // .
  // .
  ownKeys(target) {
    track(target, isArray(target) ? 'length' : ITERATE_KEY)
    return Reflect.ownKeys(target)
  },
}
```

现在，我们应该能够处理具有变化键的对象了！

## 支持基于集合的内置对象

目前，在查看 reactive.ts 的实现时，它只针对 Object 和 Array．

```ts
function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    default:
      return TargetType.INVALID
  }
}
```

在 Vue.js 中，除了这些，它还支持 Map，Set，WeakMap 和 WeakSet．

https://github.com/vuejs/core/blob/9f8e98af891f456cc8cc9019a31704e5534d1f08/packages/reactivity/src/reactive.ts#L43C1-L56C2

这些对象被实现为单独的 Proxy 处理器．它被称为 `collectionHandlers`．

在这里，我们将实现这个 `collectionHandlers` 并目标使以下代码工作．

```ts
const app = createApp({
  setup() {
    const state = reactive({ map: new Map(), set: new Set() })

    return () =>
      h('div', {}, [
        h('h1', {}, [`ReactiveCollection`]),

        h('p', {}, [
          `map (${state.map.size}): ${JSON.stringify([...state.map])}`,
        ]),
        h('button', { onClick: () => state.map.set(Date.now(), 'item') }, [
          'update map',
        ]),

        h('p', {}, [
          `set (${state.set.size}): ${JSON.stringify([...state.set])}`,
        ]),
        h('button', { onClick: () => state.set.add('item') }, ['update set']),
      ])
  },
})

app.mount('#app')
```

在 `collectionHandlers` 中，我们为 add，set 和 delete 等方法实现处理器．
这些的实现可以在 `collectionHandlers.ts` 中找到．
https://github.com/vuejs/core/blob/9f8e98af891f456cc8cc9019a31704e5534d1f08/packages/reactivity/src/collectionHandlers.ts#L0-L1
通过确定 `TargetType`，如果它是集合类型，我们基于这个处理器为 `h` 生成 Proxy．
让我们实际实现它！

需要注意的一点是，当将目标本身传递给 Reflect 的接收器时，如果目标本身设置了 Proxy，可能会导致无限循环．
为了避免这种情况，我们改变结构，将原始数据附加到目标，当实现 Proxy 处理器时，我们修改它以在这个原始数据上操作．

```ts
export const enum ReactiveFlags {
  RAW = '__v_raw',
}

export interface Target {
  [ReactiveFlags.RAW]?: any
}
```

严格来说，这个实现也应该为正常的响应式处理器完成，但为了最小化不必要的解释并且因为到目前为止没有问题，所以省略了．
让我们尝试实现它，如果进入 getter 的键是 `ReactiveFlags.RAW`，它返回原始数据而不是 Proxy．

与此同时，我们还实现了一个名为 `toRaw` 的函数，它递归地从目标检索原始数据并最终获得处于原始状态的数据．

```ts
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}
```

顺便说一下，这个 `toRaw` 函数也作为 API 函数提供．

https://vuejs.org/api/reactivity-advanced.html#toraw

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/120_proxy_handler_improvement)
