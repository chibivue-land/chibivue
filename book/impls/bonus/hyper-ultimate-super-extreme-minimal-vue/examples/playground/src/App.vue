<script>
import { reactive } from 'hyper-ultimate-super-extreme-minimal-vue'

export default {
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => state.count++
    return { state, increment }
  },
}
</script>

<template>
  <button @click="increment">state: {{ state.count }}</button>
</template>
