import { computed, createApp, h, reactive, ref } from 'chibivue'

const app = createApp({
  setup() {
    const count = reactive({ value: 0 })
    const count2 = reactive({ value: 0 })
    const double = computed(() => {
      console.log('computed')
      return count.value * 2
    })
    const doubleDouble = computed(() => {
      console.log('computed (doubleDouble)')
      return double.value * 2
    })

    const countRef = ref(0)
    const doubleCountRef = computed(() => {
      console.log('computed (doubleCountRef)')
      return countRef.value * 2
    })

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${count.value}`]),
        h('p', {}, [`count2: ${count2.value}`]),
        h('p', {}, [`double: ${double.value}`]),
        h('p', {}, [`doubleDouble: ${doubleDouble.value}`]),
        h('p', {}, [`doubleCountRef: ${doubleCountRef.value}`]),
        h('button', { onClick: () => count.value++ }, ['update count']),
        h('button', { onClick: () => count2.value++ }, ['update count2']),
        h('button', { onClick: () => countRef.value++ }, ['update countRef']),
      ])
  },
})

app.mount('#app')
