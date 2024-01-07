# Supporting the Options API

## Options API

So far, we have been able to implement a lot using the Composition API, but let's also support the Options API.

In this book, we support the following in the Options API:

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

As an implementation approach, let's prepare a function called "applyOptions" in "componentOptions.ts" and execute it towards the end of "setupComponent".

```ts
export const setupComponent = (instance: ComponentInternalInstance) => {
  // .
  // .
  // .

  if (render) {
    instance.render = render as InternalRenderFunction
  }
  // ↑ This is the existing implementation

  setCurrentInstance(instance)
  applyOptions(instance)
  unsetCurrentInstance()
}
```

In the Options API, the developer interface frequently deals with "this".

```ts
const App = defineComponent({
  data() {
    return { message: 'hello' }
  },

  methods: {
    greet() {
      console.log(this.message) // Like this
    },
  },
})
```

Internally, "this" refers to the component's proxy in the Options API, and when applying options, this proxy is bound.

Implementation example ↓

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

Basically, if you implement them one by one using this principle, it shouldn't be difficult.

If you want to make "data" reactive, call the "reactive" function here, and if you want to compute, call the "computed" function here. (The same goes for "provide/inject")

Since the instance is set by "setCurrentInstance" before "applyOptions" is executed, you can call the APIs (Composition API) you have been using so far in the same way.

Regarding properties starting with "$", they are controlled by the implementation of "componentPublicInstance". The getter in "PublicInstanceProxyHandlers" controls them.

## Typing Options API

Functionally, it is fine to implement it as described above, but typing the Options API is a bit complex.

In this book, we support basic typing for the Options API.

The difficult point is that the type of "this" changes depending on the user's definition of each option. For example, if you define a property called "count" of type "number" in the "data" option, you would want "this" in "computed" or "method" to infer "count: number".

Of course, this applies not only to "data" but also to those defined in "computed" or "methods".

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

To achieve this, you need to implement a somewhat complex type puzzle (relay with many generics).

Starting with typing for "defineComponent", we implement several types to relay to "ComponentOptions" and "ComponentPublicInstance".

Here, let's focus on "data" and "methods" for explanation.

First, the usual "ComponentOptions" type. We extend it with generics to accept the types of "data" and "methods" as parameters, "D" and "M".

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

So far, it shouldn't be too difficult. This is the type that can be applied to the arguments of "defineComponent".  
Of course, in "defineComponent" as well, we accept "D" and "M" to relay the user-defined types. This allows us to relay the user-defined types.

```ts
export function defineComponent<
  D = {},
  M extends MethodOptions = MethodOptions,
>(options: ComponentOptions<D, M>) {}
```

The problem is how to mix "D" with "this" when dealing with "this" in "methods" (how to make inference like "this.count" possible).

First, "D" and "M" are merged into "ComponentPublicInstance" (merged into the proxy). This can be understood as follows (extend with generics).

```ts
type ComponentPublicInstance<
  D = {},
  M extends MethodOptions = MethodOptions,
> = {
  /** Various types that public instance has */
} & D &
  M
```

Once we have this, we mix the instance type into "this" in "ComponentOptions".

```ts
type ComponentOptions<D = {}, M extends MethodOptions = MethodOptions> = {
  data?: () => D
  methods?: M
} & ThisType<ComponentPublicInstance<D, M>>
```

By doing this, we can infer the properties defined in "data" and "method" from "this" in the options.

In practice, we need to infer various types such as "props", "computed", and "inject", but the basic principle is the same.  
At first glance, you may be overwhelmed by the many generics and type conversions (such as extracting only the "key" from "inject"), but if you calm down and return to the principle, you should be fine.  
In the code of this book, inspired by the original Vue, we have abstracted it one step further with "CreateComponentPublicInstance" and implemented a type called "ComponentPublicInstanceConstructor", but don't worry too much about it. (If you're interested, you can read it too!)

Source code up to this point:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/070_options_api)
