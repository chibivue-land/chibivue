<script setup lang="ts">
import { ref } from 'chibivue'
import ChildComponent from './Child.vue'

const message = ref('Hello, Type-based Macros!')
const count = ref(0)
const logs = ref<string[]>([])

const handleUpdate = (payload: { message: string; count: number }) => {
  logs.value.push(`Received: message=${payload.message}, count=${payload.count}`)
}
</script>

<template>
  <div class="container">
    <h2>Type-based Macros Example</h2>
    <ChildComponent :message="message" :count="count" @update="handleUpdate" />
    <button @click="count++">Increment count</button>
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
