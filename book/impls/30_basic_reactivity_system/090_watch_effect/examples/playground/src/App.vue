<script>
import { ref, watchEffect } from 'chibivue'

export default {
  setup() {
    const count = ref(0)
    const name = ref('chibivue')
    const logs = ref([])

    // watchEffect automatically tracks dependencies
    watchEffect(() => {
      logs.value.push(`watchEffect: count=${count.value}, name=${name.value}`)
    })

    const increment = () => count.value++
    const updateName = () => (name.value = name.value + '!')

    return { count, name, logs, increment, updateName }
  },
}
</script>

<template>
  <div class="container">
    <h2>watchEffect Example</h2>

    <div>
      <p>Count: {{ count }}</p>
      <button @click="increment">Increment</button>
    </div>

    <div>
      <p>Name: {{ name }}</p>
      <button @click="updateName">Add !</button>
    </div>

    <h3>Logs (watchEffect auto-tracks both):</h3>
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
