<script setup>
import { ref } from 'chibivue'
import ChildComponent from './Child.vue'

const title = ref('Props Destructure')
const count = ref(0)
</script>

<template>
  <div class="container">
    <h2>Props Destructure Example</h2>
    <ChildComponent :title="title" :count="count" />
    <button @click="count++">Increment</button>
    <button @click="title = title + '!'">Update title</button>
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
