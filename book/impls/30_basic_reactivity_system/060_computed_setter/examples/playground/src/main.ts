import { computed, createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const count = ref(0)
    const writeableDouble = computed<number>({
      get: () => count.value * 2,
      set: val => void (count.value = val),
    })

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${count.value}`]),
        h('p', {}, [`double: ${writeableDouble.value}`]),
        h('button', { onClick: () => count.value++ }, ['update count']),
        h('button', { onClick: () => (writeableDouble.value += 1) }, [
          'update double',
        ]),
      ])
  },
})

app.mount('#app')
