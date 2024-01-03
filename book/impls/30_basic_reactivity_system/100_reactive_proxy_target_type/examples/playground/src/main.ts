import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null)
    const getRef = () => {
      inputRef.value = document.getElementById(
        'my-input',
      ) as HTMLInputElement | null
    }
    const focus = () => {
      inputRef.value?.focus()
    }

    return () =>
      h('div', {}, [
        h('input', { id: 'my-input' }, []),
        h('button', { onClick: getRef }, ['getRef']),
        h('button', { onClick: focus }, ['focus']),
      ])
  },
})

app.mount('#app')
