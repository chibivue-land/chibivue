# 插槽

## 預設插槽的實現

Vue 有一個名為插槽的功能，包括三種類型：預設插槽，命名插槽和作用域插槽．
https://vuejs.org/guide/components/slots.html#slots

這次，我們將實現其中的預設插槽．
期望的開發者介面如下：

https://vuejs.org/guide/extras/render-function.html#passing-slots

```ts
const MyComponent = defineComponent({
  setup(_, { slots }) {
    return () => h('div', {}, [slots.default()])
  },
})

const app = createApp({
  setup() {
    return () => h(MyComponent, {}, () => 'hello')
  },
})
```

機制很簡單．在插槽定義端，我們確保將 slots 作為 setupContext 接收，在使用端用 h 函式渲染組件時，我們只需將渲染函式作為 children 傳遞．
也許對每個人來說最熟悉的用法是在 SFC 的模板中放置一個 slot 元素，但這需要實現一個單獨的模板編譯器，所以我們這次省略它．（我們將在基礎模板編譯器部分介紹它．）

像往常一樣，向實例添加一個可以保存插槽的屬性，並使用 createSetupContext 將其作為 SetupContext 混合．
修改 h 函式，使其可以接收渲染函式作為第三個參數，而不僅僅是陣列，如果傳遞了渲染函式，在生成實例時將其設置為組件實例的預設插槽．
讓我們先實現到這一點！

（由於在 children 中實現了 normalize，ShapeFlags 已經略有更改．）

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/40_basic_component_system/050_component_slot)

## 命名插槽/作用域插槽的實現

這是預設插槽的擴展．
這次，讓我們嘗試傳遞一個物件而不是函式．

對於作用域插槽，你只需要定義渲染函式的參數．
如你所見，當使用渲染函式時，似乎沒有必要區分作用域插槽．
沒錯，插槽的本質只是一個回呼函式，API 作為作用域插槽提供以允許向其傳遞參數．
當然，我們將在基礎模板編譯器部分實現一個可以處理作用域插槽的編譯器，但它們將被轉換為這些形式．

https://vuejs.org/guide/components/slots.html#scoped-slots

```ts
const MyComponent = defineComponent({
  setup(_, { slots }) {
    return () =>
      h('div', {}, [
        slots.default?.(),
        h('br', {}, []),
        slots.myNamedSlot?.(),
        h('br', {}, []),
        slots.myScopedSlot2?.({ message: 'hello!' }),
      ])
  },
})

const app = createApp({
  setup() {
    return () =>
      h(
        MyComponent,
        {},
        {
          default: () => 'hello',
          myNamedSlot: () => 'hello2',
          myScopedSlot2: (scope: { message: string }) =>
            `message: ${scope.message}`,
        },
      )
  },
})
```

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/40_basic_component_system/060_slot_extend)
