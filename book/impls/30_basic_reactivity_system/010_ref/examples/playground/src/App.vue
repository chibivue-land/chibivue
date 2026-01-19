<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const count = ref(0)
    const message = ref('Hello, chibivue!')

    const increment = () => {
      count.value++
    }

    const updateMessage = () => {
      message.value = `Count is now ${count.value}`
    }

    return { count, message, increment, updateMessage }
  },
}
</script>

<template>
  <div class="container">
    <h2>ref Example</h2>

    <p>Count: {{ count }}</p>
    <p>Message: {{ message }}</p>

    <button @click="increment">Increment</button>
    <button @click="updateMessage">Update Message</button>
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
