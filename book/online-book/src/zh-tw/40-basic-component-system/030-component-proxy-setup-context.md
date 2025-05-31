# 組件的代理和 setupContext

## 組件的代理

組件有一個重要概念叫做代理（Proxy）．  
簡單來說，它是一個允許存取組件實例資料（公共屬性）的代理．
代理結合了 setup 的結果（狀態，函式），data，props 和其他存取．

讓我們考慮以下程式碼（包括在 chibivue 中未實現的部分，所以請將其視為常規 Vue）：

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

這段程式碼工作正常，但它是如何綁定到模板的？

讓我們考慮另一個例子．

```vue
<script setup>
const ChildRef = ref()

// 存取組件的方法和資料
// ChildRef.value?.incrementData
// ChildRef.value?.increment
</script>

<template>
  <!-- Child 是前面提到的組件 -->
  <Child :ref="ChildRef" />
</template>
```

在這種情況下，你可以透過 ref 存取組件的資訊．

為了實現這一點，ComponentInternalInstance 有一個名為 proxy 的屬性，它保存用於資料存取的代理．

換句話說，模板（渲染函式）和 ref 引用 instance.proxy．

```ts
interface ComponentInternalInstance {
  proxy: ComponentPublicInstance | null
}
```

這個代理的實現是使用 Proxy 完成的，大致如下：

```ts
instance.proxy = instance.proxy = new Proxy(
  instance,
  PublicInstanceProxyHandlers,
)

export const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  get(instance: ComponentRenderContext, key: string) {
    const { setupState, ctx, props } = instance

    // 根據鍵按 setupState -> props -> ctx 的順序檢查，如果存在則返回值
  },
}
```

讓我們實現這個代理！

一旦實現，讓我們修改程式碼以將此代理傳遞給渲染函式和 ref．

到此為止的原始碼：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/40_basic_component_system/030_component_proxy)

※ 順便說一下，我還實現了 defineComponent 和相關類型檢查的實現（這允許我們推斷代理資料的類型）．

![infer_component_types](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/infer_component_types.png)

## setupContext

https://ja.vuejs.org/api/composition-api-setup.html#setup-context

Vue 有一個名為 setupContext 的概念．這是在 setup 函式中暴露的上下文，包括 emit 和 expose．

目前，emit 正在工作，但實現有些粗糙．

```ts
const setupResult = component.setup(instance.props, {
  emit: instance.emit,
})
```

讓我們正確定義 SetupContext 介面，並將其表示為實例持有的物件．

```ts
export interface ComponentInternalInstance {
  // .
  // .
  // .
  setupContext: SetupContext | null // 添加
}

export type SetupContext = {
  emit: (e: string, ...args: any[]) => void
}
```

然後，在創建實例時，生成 setupContext 並在執行 setup 函式時將此物件作為第二個參數傳遞．

## expose

一旦你到達這一點，讓我們嘗試實現除 emit 之外的 SetupContext．  
作為這次的例子，讓我們實現 expose．

expose 是一個允許你明確定義公共屬性的函式．  
讓我們目標實現如下的開發者介面：

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
        child.value.count2, // 無法存取
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

對於不使用 expose 的組件，預設情況下一切仍然是公共的．

作為方向，讓我們在實例內部有一個名為 `exposed` 的物件，如果這裡設置了值，我們將把這個物件傳遞給 templateRef 的 ref．

```ts
export interface ComponentInternalInstance {
  // .
  // .
  // .
  exposed: Record<string, any> | null // 添加
}
```

讓我們實現 expose 函式，以便可以在這裡註冊物件．

## ProxyRefs

在本章中，我們實現了 proxy 和 exposedProxy，但實際上與原始 Vue 有一些差異．
那就是"ref 被解包"．（在 proxy 的情況下，setupState 具有此屬性而不是 proxy．）

這些是用 ProxyRefs 實現的，處理器在名為 `shallowUnwrapHandlers` 的名稱下實現．
這允許我們在編寫模板或處理代理時消除 ref 特定值的冗餘．

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
  <!-- <p>{{ count.value }}</p>  不需要這樣寫 -->
  <p>{{ count }}</p>
</template>
```

如果你實現到這一點，以下程式碼應該工作．

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
      child.value.count2++ // 無法存取
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

## 模板綁定和 with 語句

實際上，本章的更改存在一個問題．
讓我們嘗試執行以下程式碼：

```ts
const Child2 = {
  setup() {
    const state = reactive({ count: 0 })
    return { state }
  },
  template: `<p>child2 count: {{ state.count }}</p>`,
}
```

這只是一個簡單的程式碼，但它不工作．
它抱怨 state 未定義．

![state_is_not_defined](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/state_is_not_defined.png)

原因是當將代理作為參數傳遞給 with 語句時，必須定義 has．

[使用 with 語句和代理創建動態命名空間 (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/with#creating_dynamic_namespaces_using_the_with_statement_and_a_proxy)

所以讓我們在 PublicInstanceProxyHandlers 中實現 has．
如果鍵存在於 setupState，props 或 ctx 中，它應該返回 true．

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

如果它工作正常，應該可以正常工作！

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/40_basic_component_system/040_setup_context)
