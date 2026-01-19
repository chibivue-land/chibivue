<script setup>
import { ref, onActivated, onDeactivated } from 'chibivue'

const count = ref(0)
const status = ref('active')

onActivated(() => {
  status.value = 'activated'
  console.log('Counter activated')
})

onDeactivated(() => {
  status.value = 'deactivated'
  console.log('Counter deactivated')
})
</script>

<template>
  <div class="counter">
    <p>Count: {{ count }}</p>
    <p>Status: {{ status }}</p>
    <button @click="count++">Increment</button>
  </div>
</template>

<style>
.counter {
  padding: 16px;
  background-color: #f0f0f0;
  border-radius: 4px;
  margin: 8px 0;
}
</style>
