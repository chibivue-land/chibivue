# Proxy and setupContext of Components

## Proxy of Components

One important concept that components have is called Proxy.  
In simple terms, it is a Proxy that allows access to the data (public properties) of the component instance.
The Proxy combines the results of setup (state, functions), data, props, and other accesses.

Let's consider the following code (including parts that are not implemented in chibivue, so please think of it as regular Vue):

```vue
<script>
export default defineComponent({
  props: { parentCount: { type: Number, default: 0 } },
  data() {
    return { dataState: { count: 0 } }
  },
  methods: {
    incrementData() {
      this.dataState.count++
    },
  },
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => {
      state.count++
    }

    return { state, increment }
  },
})
</script>

<template>
  <div>
    <p>count (parent): {{ parentCount }}</p>

    <br />

    <p>count (data): {{ dataState.count }}</p>
    <button @click="incrementData">increment (data)</button>

    <br />

    <p>count: {{ state.count }}</p>
    <button @click="increment">increment</button>
  </div>
</template>
```

This code works correctly, but how is it bound to the template?

Let's consider another example.

```vue
<script setup>
const ChildRef = ref()

// Access to methods and data of the component
// ChildRef.value?.incrementData
// ChildRef.value?.increment
</script>

<template>
  <!-- Child is the component mentioned earlier -->
  <Child :ref="ChildRef" />
</template>
```

In this case, you can access the component's information through ref.

To achieve this, the ComponentInternalInstance has a property called proxy, which holds the Proxy for data access.

In other words, the template (render function) and ref refer to instance.proxy.

```ts
interface ComponentInternalInstance {
  proxy: ComponentPublicInstance | null
}
```

The implementation of this proxy is done using Proxy, and it is roughly as follows:

```ts
instance.proxy = instance.proxy = new Proxy(
  instance,
  PublicInstanceProxyHandlers,
)

export const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  get(instance: ComponentRenderContext, key: string) {
    const { setupState, ctx, props } = instance

    // Check setupState -> props -> ctx in order based on the key and return the value if it exists
  },
}
```

Let's implement this Proxy!

Once implemented, let's modify the code to pass this proxy to the render function and ref.

Source code so far:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/030_component_proxy)

※ By the way, I have also implemented the implementation of defineComponent and related type checking (this allows us to infer the type of proxy data).

![infer_component_types](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/infer_component_types.png)

## setupContext

https://ja.vuejs.org/api/composition-api-setup.html#setup-context

Vue has a concept called setupContext. This is the context exposed in the setup function, which includes emit and expose.

At the moment, emit is working, but it is implemented somewhat roughly.

```ts
const setupResult = component.setup(instance.props, {
  emit: instance.emit,
})
```

Let's define the SetupContext interface properly and represent it as an object that the instance holds.

```ts
export interface ComponentInternalInstance {
  // .
  // .
  // .
  setupContext: SetupContext | null // Added
}

export type SetupContext = {
  emit: (e: string, ...args: any[]) => void
}
```

Then, when creating an instance, generate the setupContext and pass this object as the second argument when executing the setup function.

## expose

Once you've reached this point, let's try implementing SetupContext other than emit.  
As an example this time, let's implement expose.

expose is a function that allows you to explicitly define public properties.  
Let's aim for a developer interface like the following:

```ts
const Child = defineComponent({
  setup(_, { expose }) {
    const count = ref(0)
    const count2 = ref(0)
    expose({ count })
    return { count, count2 }
  },
  template: `<p>hello</p>`,
})

const Child2 = defineComponent({
  setup() {
    const count = ref(0)
    const count2 = ref(0)
    return { count, count2 }
  },
  template: `<p>hello</p>`,
})

const app = createApp({
  setup() {
    const child = ref()
    const child2 = ref()

    const log = () => {
      console.log(
        child.value.count,
        child.value.count2, // cannot access
        child2.value.count,
        child2.value.count2,
      )
    }

    return () =>
      h('div', {}, [
        h(Child, { ref: child }, []),
        h(Child2, { ref: child2 }, []),
        h('button', { onClick: log }, ['log']),
      ])
  },
})
```

For components that do not use expose, everything is still public by default.

As a direction, let's have an object called `exposed` inside the instance, and if a value is set here, we will pass this object to ref for templateRef.

```ts
export interface ComponentInternalInstance {
  // .
  // .
  // .
  exposed: Record<string, any> | null // added
}
```

Let's implement the expose function so that objects can be registered here.

## ProxyRefs

In this chapter, we have implemented proxy and exposedProxy, but there are actually some differences from the original Vue.  
That is, "ref is unwrapped". (In the case of proxy, setupState has this property rather than proxy.)

These are implemented with ProxyRefs, and the handler is implemented under the name `shallowUnwrapHandlers`.  
This allows us to eliminate the redundancy of ref-specific values when writing templates or dealing with proxies.

```ts
const shallowUnwrapHandlers: ProxyHandler<any> = {
  get: (target, key, receiver) => unref(Reflect.get(target, key, receiver)),
  set: (target, key, value, receiver) => {
    const oldValue = target[key]
    if (isRef(oldValue) && !isRef(value)) {
      oldValue.value = value
      return true
    } else {
      return Reflect.set(target, key, value, receiver)
    }
  },
}
```

```vue
<template>
  <!-- <p>{{ count.value }}</p>  There is no need to write like this -->
  <p>{{ count }}</p>
</template>
```

If you implement it up to this point, the following code should work.

```ts
import { createApp, defineComponent, h, ref } from 'chibivue'

const Child = defineComponent({
  setup(_, { expose }) {
    const count = ref(0)
    const count2 = ref(0)
    expose({ count })
    return { count, count2 }
  },
  template: `<p>child {{ count }} {{ count2 }}</p>`,
})

const Child2 = defineComponent({
  setup() {
    const count = ref(0)
    const count2 = ref(0)
    return { count, count2 }
  },
  template: `<p>child2 {{ count }} {{ count2 }}</p>`,
})

const app = createApp({
  setup() {
    const child = ref()
    const child2 = ref()

    const increment = () => {
      child.value.count++
      child.value.count2++ // cannot access
      child2.value.count++
      child2.value.count2++
    }

    return () =>
      h('div', {}, [
        h(Child, { ref: child }, []),
        h(Child2, { ref: child2 }, []),
        h('button', { onClick: increment }, ['increment']),
      ])
  },
})

app.mount('#app')
```

## Template Binding and with Statement

Actually, there is a problem with the changes in this chapter.  
Let's try running the following code:

```ts
const Child2 = {
  setup() {
    const state = reactive({ count: 0 })
    return { state }
  },
  template: `<p>child2 count: {{ state.count }}</p>`,
}
```

It's just a simple code, but it doesn't work.  
It complains that state is not defined.

![state_is_not_defined](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/state_is_not_defined.png)

The reason for this is that when passing a Proxy as an argument to the with statement, has must be defined.

[Creating dynamic namespaces using the with statement and a proxy (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/with#creating_dynamic_namespaces_using_the_with_statement_and_a_proxy)

So let's implement has in PublicInstanceProxyHandlers.  
If the key exists in setupState, props, or ctx, it should return true.

```ts
export const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  // .
  // .
  // .
  has(
    { _: { setupState, ctx, propsOptions } }: ComponentRenderContext,
    key: string,
  ) {
    let normalizedProps
    return (
      hasOwn(setupState, key) ||
      ((normalizedProps = propsOptions[0]) && hasOwn(normalizedProps, key)) ||
      hasOwn(ctx, key)
    )
  },
}
```

If it works correctly, it should work fine!

Source code up to this point:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/040_setup_context)
