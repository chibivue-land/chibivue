import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const count = ref(0)

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${count.value}`]),
        h('button', { onClick: () => count.value++ }, ['Increment']),
      ])
  },
})

app.mount('#app')
