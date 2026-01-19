<script>
import { ref, watch } from 'chibivue'

export default {
  setup() {
    const count = ref(0)
    const message = ref('')
    const logs = ref([])

    // Watch with immediate option
    watch(
      count,
      (newVal, oldVal) => {
        logs.value.push(`[immediate] count changed: ${oldVal} -> ${newVal}`)
      },
      { immediate: true }
    )

    // Watch with deep option
    const obj = ref({ nested: { value: 0 } })
    watch(
      obj,
      (newVal) => {
        logs.value.push(`[deep] nested.value = ${newVal.nested.value}`)
      },
      { deep: true }
    )

    const increment = () => count.value++
    const updateNested = () => obj.value.nested.value++

    return { count, message, logs, obj, increment, updateNested }
  },
}
</script>

<template>
  <div class="container">
    <h2>watch API Extensions Example</h2>

    <div>
      <p>Count: {{ count }}</p>
      <button @click="increment">Increment (immediate watch)</button>
    </div>

    <div>
      <p>Nested value: {{ obj.nested.value }}</p>
      <button @click="updateNested">Update nested (deep watch)</button>
    </div>

    <h3>Logs:</h3>
    <ul>
      <li v-for="(log, i) in logs" :key="i">{{ log }}</li>
    </ul>
  </div>
</template>

<style>
.container {
  padding: 16px;
}
button {
  margin-right: 8px;
}
</style>
