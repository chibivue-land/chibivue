<script setup>
import { ref, KeepAlive } from 'chibivue'
import CounterComponent from './Counter.vue'

const showCounter = ref(true)
const toggle = () => {
  showCounter.value = !showCounter.value
}
</script>

<template>
  <div class="container">
    <h2>KeepAlive Example</h2>
    <button @click="toggle">Toggle Counter</button>

    <h3>With KeepAlive (state preserved):</h3>
    <KeepAlive>
      <CounterComponent v-if="showCounter" />
    </KeepAlive>

    <h3>Without KeepAlive (state reset):</h3>
    <CounterComponent v-if="showCounter" />
  </div>
</template>

<style>
.container {
  padding: 16px;
}
</style>
