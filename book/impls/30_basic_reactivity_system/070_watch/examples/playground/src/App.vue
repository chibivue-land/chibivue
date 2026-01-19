<script>
import { ref, watch } from 'chibivue'

export default {
  setup() {
    const count = ref(0)
    const name = ref('chibivue')
    const logs = ref([])

    // Watch single ref
    watch(count, (newVal, oldVal) => {
      logs.value.push(`count changed: ${oldVal} -> ${newVal}`)
    })

    // Watch another ref
    watch(name, (newVal, oldVal) => {
      logs.value.push(`name changed: "${oldVal}" -> "${newVal}"`)
    })

    const increment = () => count.value++
    const updateName = () => (name.value = name.value + '!')

    return { count, name, logs, increment, updateName }
  },
}
</script>

<template>
  <div class="container">
    <h2>watch Example</h2>

    <div>
      <p>Count: {{ count }}</p>
      <button @click="increment">Increment</button>
    </div>

    <div>
      <p>Name: {{ name }}</p>
      <button @click="updateName">Add !</button>
    </div>

    <h3>Watch Logs:</h3>
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
