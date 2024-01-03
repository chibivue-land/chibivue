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
