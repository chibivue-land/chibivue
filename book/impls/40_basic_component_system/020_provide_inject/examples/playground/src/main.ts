import {
  type InjectionKey,
  createApp,
  h,
  inject,
  provide,
  reactive,
} from 'chibivue'

const Child = {
  setup() {
    const rootState = inject<{ count: number }>('RootState')
    const logger = inject(LoggerKey)

    const action = () => {
      rootState && rootState.count++
      logger?.('Hello from Child.')
    }

    return () => h('button', { onClick: action }, ['action'])
  },
}

const app = createApp({
  setup() {
    const state = reactive({ count: 1 })
    provide('RootState', state)

    return () =>
      h('div', {}, [h('p', {}, [`${state.count}`]), h(Child, {}, [])])
  },
})

type Logger = (...args: any) => void
const LoggerKey = Symbol() as InjectionKey<Logger>

app.provide(LoggerKey, window.console.log)

app.mount('#app')
