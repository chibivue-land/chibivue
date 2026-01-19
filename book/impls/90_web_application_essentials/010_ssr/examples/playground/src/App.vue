<script setup>
import { ref, onMounted } from 'chibivue'

const count = ref(0)
const isClient = ref(false)

onMounted(() => {
  isClient.value = true
})
</script>

<template>
  <div class="container">
    <h2>SSR Example</h2>
    <p>Count: {{ count }}</p>
    <button @click="count++">Increment</button>
    <p v-if="isClient">This content is only visible on the client (hydrated)</p>
    <p v-else>This content is from SSR</p>
  </div>
</template>

<style>
.container {
  padding: 16px;
}
</style>
