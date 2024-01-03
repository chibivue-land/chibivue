<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const count = ref(0)
    const increment = () => {
      count.value++
    }
    return { count, increment }
  },
}
</script>

<template>
  <div>
    <button :onClick="increment">count + count is: {{ count + count }}</button>
  </div>
</template>
