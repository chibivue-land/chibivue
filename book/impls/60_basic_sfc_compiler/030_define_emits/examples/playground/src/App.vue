<script setup>
import { ref } from 'chibivue'
import ChildComponent from './Child.vue'

const count = ref(0)
const logs = ref([])

const handleIncrement = () => {
  count.value++
  logs.value.push(`increment event received`)
}

const handleCustomEvent = (payload) => {
  logs.value.push(`custom event: ${payload}`)
}
</script>

<template>
  <div class="container">
    <h2>defineEmits Example</h2>
    <p>Parent count: {{ count }}</p>
    <ChildComponent @increment="handleIncrement" @custom-event="handleCustomEvent" />
    <h3>Event Logs:</h3>
    <ul>
      <li v-for="(log, i) in logs" :key="i">{{ log }}</li>
    </ul>
  </div>
</template>

<style>
.container {
  padding: 16px;
}
</style>
