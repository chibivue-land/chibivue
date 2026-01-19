<script setup>
import { ref } from 'chibivue'
import ChildComponent from './Child.vue'

const message = ref('Hello from Parent!')
const count = ref(42)
</script>

<template>
  <div class="container">
    <h2>defineProps Example</h2>
    <ChildComponent :message="message" :count="count" />
    <button @click="count++">Increment from parent</button>
  </div>
</template>

<style>
.container {
  padding: 16px;
}
</style>
