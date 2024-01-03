import {
  createApp,
  h,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  onUnmounted,
  onUpdated,
  ref,
} from 'chibivue'

const Child = {
  setup() {
    const count = ref(0)
    onBeforeMount(() => {
      console.log('onBeforeMount')
    })

    onUnmounted(() => {
      console.log('onUnmounted')
    })

    onBeforeUnmount(() => {
      console.log('onBeforeUnmount')
    })

    onBeforeUpdate(() => {
      console.log('onBeforeUpdate')
    })

    onUpdated(() => {
      console.log('onUpdated')
    })

    onMounted(() => {
      console.log('onMounted')
    })

    return () =>
      h('div', {}, [
        h('p', {}, [`${count.value}`]),
        h('button', { onClick: () => count.value++ }, ['increment']),
      ])
  },
}

const app = createApp({
  setup() {
    const mountFlag = ref(true)

    return () =>
      h('div', {}, [
        h('button', { onClick: () => (mountFlag.value = !mountFlag.value) }, [
          'toggle',
        ]),
        mountFlag.value ? h(Child, {}, []) : h('p', {}, ['unmounted']),
      ])
  },
})

app.mount('#app')
