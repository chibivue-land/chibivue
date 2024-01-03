import { createApp, defineComponent, h, ref } from 'chibivue'

const MyComponent = defineComponent({
  setup(_, { slots }) {
    return () =>
      h('div', {}, [
        h('h1', {}, ['this is my component']),
        h('div', { style: 'border: 1px solid black;' }, [
          h('h2', { style: 'border-bottom: 1px solid black;' }, ['slotted']),
          slots.default?.(),
        ]),
      ])
  },
})

const app = createApp({
  setup() {
    const count = ref(0)
    return () =>
      h(MyComponent, {}, () =>
        h('div', {}, [
          h('button', { onClick: () => count.value++ }, ['increment']),
          h('p', {}, [`count is ${count.value}`]),
        ]),
      )
  },
})

app.mount('#app')
