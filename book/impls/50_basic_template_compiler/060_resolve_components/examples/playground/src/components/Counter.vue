<script>
import { ref, defineComponent } from 'chibivue'

export default defineComponent({
  setup() {
    const count = ref(0)
    return { count }
  },
})
</script>

<template>
  <button @click="count++">count: {{ count }}</button>
</template>
