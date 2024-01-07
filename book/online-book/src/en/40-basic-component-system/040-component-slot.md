# Slots

## Implementation of Default Slot

Vue has a feature called slots, which includes three types: default slot, named slot, and scoped slot.
https://vuejs.org/guide/components/slots.html#slots

This time, we will implement the default slot among them.
The desired developer interface is as follows:

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

The mechanism is simple. On the slot definition side, we make sure to receive slots as setupContext, and when rendering the component with the h function on the usage side, we simply pass the render function as children.
Perhaps the most familiar usage for everyone is to place a slot element in the template of SFC, but that requires implementing a separate template compiler, so we will omit it this time. (We will cover it in the Basic Template Compiler section.)

As usual, add a property that can hold slots to the instance and mix it as SetupContext with createSetupContext.
Modify the h function so that it can receive a render function as the third argument, not just an array, and if a render function is passed, set it as the default slot of the component instance when generating the instance.
Let's implement it up to this point for now!

(ShapeFlags has been slightly changed due to the implementation of normalize in children.)

Source code up to this point:
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/050_component_slot)

## Implementation of Named Slots/Scoped Slots

This is an extension of the default slot.
This time, let's try passing an object instead of a function.

For scoped slots, you just need to define the arguments of the render function.
As you can see, when using a render function, it doesn't seem necessary to distinguish scoped slots.
That's right, the essence of slots is just a callback function, and the API is provided as scoped slots to allow passing arguments to it.
Of course, we will implement a compiler in the Basic Template Compiler section that can handle scoped slots, but they will be converted to these forms.

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

Source code up to this point:
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/060_slot_extend)
