# 支持 Options API

## Options API

到目前为止，我们已经能够使用 Composition API 实现很多功能，但让我们也支持 Options API。

在本书中，我们在 Options API 中支持以下内容：

- props
- data
- computed
- method
- watch
- slot
- lifecycle
  - onMounted
  - onUpdated
  - onUnmounted
  - onBeforeMount
  - onBeforeUpdate
  - onBeforeUnmount
- provide/inject
- $el
- $data
- $props
- $slots
- $parent
- $emit
- $forceUpdate
- $nextTick

作为实现方法，让我们在 "componentOptions.ts" 中准备一个名为 "applyOptions" 的函数，并在 "setupComponent" 的末尾执行它。

```ts
export const setupComponent = (instance: ComponentInternalInstance) => {
  // .
  // .
  // .

  if (render) {
    instance.render = render as InternalRenderFunction
  }
  // ↑ 这是现有实现

  setCurrentInstance(instance)
  applyOptions(instance)
  unsetCurrentInstance()
}
```

在 Options API 中，开发者接口经常处理 "this"。

```ts
const App = defineComponent({
  data() {
    return { message: 'hello' }
  },

  methods: {
    greet() {
      console.log(this.message) // 像这样
    },
  },
})
```

在内部，"this" 在 Options API 中指向组件的代理，在应用选项时，这个代理被绑定。

实现示例 ↓

```ts
export function applyOptions(instance: ComponentInternalInstance) {
  const { type: options } = instance
  const publicThis = instance.proxy! as any
  const ctx = instance.ctx

  const { methods } = options

  if (methods) {
    for (const key in methods) {
      const methodHandler = methods[key]
      if (isFunction(methodHandler)) {
        ctx[key] = methodHandler.bind(publicThis)
      }
    }
  }
}
```

基本上，如果你使用这个原理逐一实现它们，应该不会太困难。

如果你想让 "data" 变成响应式，在这里调用 "reactive" 函数，如果你想计算，在这里调用 "computed" 函数。（"provide/inject" 也是如此）

由于在执行 "applyOptions" 之前通过 "setCurrentInstance" 设置了实例，你可以以相同的方式调用到目前为止一直使用的 API（Composition API）。

关于以 "$" 开头的属性，它们由 "componentPublicInstance" 的实现控制。"PublicInstanceProxyHandlers" 中的 getter 控制它们。

## 为 Options API 添加类型

在功能上，按照上述描述实现是可以的，但为 Options API 添加类型有点复杂。

在本书中，我们为 Options API 支持基本类型。

困难的地方在于 "this" 的类型根据用户对每个选项的定义而改变。例如，如果你在 "data" 选项中定义一个名为 "count" 的 "number" 类型属性，你希望 "computed" 或 "method" 中的 "this" 推断出 "count: number"。

当然，这不仅适用于 "data"，也适用于在 "computed" 或 "methods" 中定义的那些。

```ts
const App = defineComponent({
  data() {
    return { count: 0 }
  },

  methods: {
    myMethod() {
      this.count // number
      this.myComputed // number
    },
  },

  computed: {
    myComputed() {
      return this.count // number
    },
  },
})
```

为了实现这一点，你需要实现一个有些复杂的类型拼图（具有许多泛型的中继）。

从 "defineComponent" 的类型开始，我们实现几种类型来中继到 "ComponentOptions" 和 "ComponentPublicInstance"。

在这里，让我们专注于 "data" 和 "methods" 进行解释。

首先，通常的 "ComponentOptions" 类型。我们用泛型扩展它以接受 "data" 和 "methods" 的类型作为参数，"D" 和 "M"。

```ts
export type ComponentOptions<
  D = {},
  M extends MethodOptions = MethodOptions
> = {
  data?: () => D;,
  methods?: M;
};

interface MethodOptions {
  [key: string]: Function;
}
```

到目前为止，应该不会太困难。这是可以应用于 "defineComponent" 参数的类型。  
当然，在 "defineComponent" 中，我们也接受 "D" 和 "M" 来中继用户定义的类型。这允许我们中继用户定义的类型。

```ts
export function defineComponent<
  D = {},
  M extends MethodOptions = MethodOptions,
>(options: ComponentOptions<D, M>) {}
```

问题是在 "methods" 中处理 "this" 时如何将 "D" 与 "this" 混合（如何使 "this.count" 这样的推断成为可能）。

首先，"D" 和 "M" 被合并到 "ComponentPublicInstance" 中（合并到代理中）。这可以理解如下（用泛型扩展）。

```ts
type ComponentPublicInstance<
  D = {},
  M extends MethodOptions = MethodOptions,
> = {
  /** 公共实例具有的各种类型 */
} & D &
  M
```

一旦我们有了这个，我们就将实例类型混合到 "ComponentOptions" 中的 "this" 中。

```ts
type ComponentOptions<D = {}, M extends MethodOptions = MethodOptions> = {
  data?: () => D
  methods?: M
} & ThisType<ComponentPublicInstance<D, M>>
```

通过这样做，我们可以从选项中的 "this" 推断在 "data" 和 "method" 中定义的属性。

在实践中，我们需要推断各种类型，如 "props"、"computed" 和 "inject"，但基本原理是相同的。  
乍一看，你可能会被许多泛型和类型转换（如从 "inject" 中仅提取 "key"）所压倒，但如果你冷静下来并回到原理，你应该没问题。  
在本书的代码中，受原始 Vue 的启发，我们用 "CreateComponentPublicInstance" 进一步抽象了一步，并实现了一个名为 "ComponentPublicInstanceConstructor" 的类型，但不要太担心。（如果你感兴趣，你也可以阅读它！）

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/40_basic_component_system/070_options_api)
