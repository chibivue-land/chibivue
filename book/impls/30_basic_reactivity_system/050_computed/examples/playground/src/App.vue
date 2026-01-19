<script>
import { ref, computed } from 'chibivue'

export default {
  setup() {
    const count = ref(0)
    const price = ref(100)

    // Computed property
    const doubleCount = computed(() => count.value * 2)
    const total = computed(() => count.value * price.value)

    const increment = () => count.value++
    const decrement = () => count.value--
    const increasePrice = () => (price.value += 50)

    return { count, price, doubleCount, total, increment, decrement, increasePrice }
  },
}
</script>

<template>
  <div class="container">
    <h2>computed Example</h2>

    <div>
      <p>Count: {{ count }}</p>
      <p>Price: {{ price }}</p>
    </div>

    <div>
      <p>Double count (computed): {{ doubleCount }}</p>
      <p>Total (count * price): {{ total }}</p>
    </div>

    <button @click="increment">Increment</button>
    <button @click="decrement">Decrement</button>
    <button @click="increasePrice">Increase Price</button>
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
