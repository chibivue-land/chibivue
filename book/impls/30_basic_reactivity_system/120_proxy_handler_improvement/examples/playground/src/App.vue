<script>
import { reactive, ref } from 'chibivue'

export default {
  setup() {
    const state = reactive({
      count: 0,
      items: [1, 2, 3],
      nested: { value: 'hello' },
    })

    // Demonstrate various proxy operations
    const incrementCount = () => state.count++
    const pushItem = () => state.items.push(state.items.length + 1)
    const deleteItem = () => state.items.pop()
    const updateNested = () => (state.nested.value += '!')

    // Check 'in' operator
    const hasCount = ref('count' in state)

    // Check keys iteration
    const keys = ref(Object.keys(state))

    return {
      state,
      incrementCount,
      pushItem,
      deleteItem,
      updateNested,
      hasCount,
      keys,
    }
  },
}
</script>

<template>
  <div class="container">
    <h2>Proxy Handler Improvement Example</h2>

    <div>
      <p>Count: {{ state.count }}</p>
      <button @click="incrementCount">Increment</button>
    </div>

    <div>
      <p>Items: {{ state.items }}</p>
      <button @click="pushItem">Push</button>
      <button @click="deleteItem">Pop</button>
    </div>

    <div>
      <p>Nested: {{ state.nested.value }}</p>
      <button @click="updateNested">Update nested</button>
    </div>

    <div>
      <p>Has 'count' property: {{ hasCount }}</p>
      <p>Object keys: {{ keys }}</p>
    </div>
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
