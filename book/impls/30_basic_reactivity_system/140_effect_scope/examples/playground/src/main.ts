import { createApp, h, reactive, watch } from 'chibivue'

const Component = {
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => {
      state.count++
    }

    const unwatch = watch(
      () => state.count,
      (newValue, oldValue, cleanup) => {
        alert(`New value: ${newValue}, old value: ${oldValue}`)
        cleanup(() => alert('Clean Up!'))
      },
    )

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, [`increment`]),
        h('button', { onClick: unwatch }, [`unwatch`]),
      ])
  },
}

const app = createApp({
  setup() {
    const isMounted = reactive({ value: false })
    const toggle = () => {
      isMounted.value = !isMounted.value
    }

    return () =>
      h('div', {}, [
        h('p', {}, [`isMounted: ${isMounted.value}`]),
        h('button', { onClick: toggle }, [`toggle`]),
        isMounted.value ? h(Component, {}, []) : h('div', {}, []),
      ])
  },
})

app.mount('#app')
