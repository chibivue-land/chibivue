import { ref, computed, h, defineComponent } from 'chibivue'

export default defineComponent(() => {
  const count = ref(0)
  const increment = () => {
    count.value++
  }

  const countDouble = computed(() => count.value * 2)

  return () =>
    h('div', [
      h('h1', `inline component`),
      h('p', `count: ${count.value}`),
      h('p', `countDouble: ${countDouble.value}`),
      h('button', { onClick: increment }, 'increment'),
    ])
})
