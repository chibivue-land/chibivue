import { createApp, customRef, h } from 'chibivue'

export function useDebouncedRef<T>(value: T, delay = 1000) {
  let timeout: number
  return customRef((track, trigger) => {
    return {
      get() {
        track()
        return value
      },
      set(newValue: T) {
        window.clearTimeout(timeout)
        timeout = window.setTimeout(() => {
          value = newValue
          trigger()
        }, delay)
      },
    }
  })
}

const CustomRef = {
  setup() {
    const text = useDebouncedRef('hello')

    return () =>
      h('div', {}, [
        h('h1', {}, ['CustomRef']),
        h('p', {}, [`${text.value}`]),
        h(
          'input',
          {
            value: text.value,
            onInput: (e: any) => (text.value = e.target.value),
          },
          [],
        ),
      ])
  },
}

const app = createApp({
  setup() {
    return () => h('div', {}, [h(CustomRef, {}, [])])
  },
})

app.mount('#app')
