import { createApp, h, reactive } from 'chibivue'

const CounterComponent = {
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => state.count++

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, ['increment']),
      ])
  },
}

const app = createApp({
  setup: () => {
    return () =>
      h('div', { id: 'my-app' }, [
        h(CounterComponent, {}, []),
        h(CounterComponent, {}, []),
        h(CounterComponent, {}, []),
      ])
  },
})

app.mount('#app')
