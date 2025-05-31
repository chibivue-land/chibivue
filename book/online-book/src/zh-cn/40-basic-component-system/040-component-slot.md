# 插槽

## 默认插槽的实现

Vue 有一个名为插槽的功能，包括三种类型：默认插槽，命名插槽和作用域插槽．
https://vuejs.org/guide/components/slots.html#slots

这次，我们将实现其中的默认插槽．
期望的开发者接口如下：

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

机制很简单．在插槽定义端，我们确保将 slots 作为 setupContext 接收，在使用端用 h 函数渲染组件时，我们只需将渲染函数作为 children 传递．
也许对每个人来说最熟悉的用法是在 SFC 的模板中放置一个 slot 元素，但这需要实现一个单独的模板编译器，所以我们这次省略它．（我们将在基础模板编译器部分介绍它．）

像往常一样，向实例添加一个可以保存插槽的属性，并使用 createSetupContext 将其作为 SetupContext 混合．
修改 h 函数，使其可以接收渲染函数作为第三个参数，而不仅仅是数组，如果传递了渲染函数，在生成实例时将其设置为组件实例的默认插槽．
让我们先实现到这一点！

（由于在 children 中实现了 normalize，ShapeFlags 已经略有更改．）

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/40_basic_component_system/050_component_slot)

## 命名插槽/作用域插槽的实现

这是默认插槽的扩展．
这次，让我们尝试传递一个对象而不是函数．

对于作用域插槽，你只需要定义渲染函数的参数．
如你所见，当使用渲染函数时，似乎没有必要区分作用域插槽．
没错，插槽的本质只是一个回调函数，API 作为作用域插槽提供以允许向其传递参数．
当然，我们将在基础模板编译器部分实现一个可以处理作用域插槽的编译器，但它们将被转换为这些形式．

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

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/40_basic_component_system/060_slot_extend)
