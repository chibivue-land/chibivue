<script setup>
import { ref } from 'chibivue'
const count = ref(0)
</script>

<template>
  <div id="pages-counter">
    <h1>Counter</h1>
    <button @click="count++">increment</button>
    <p>{{ count }}</p>
  </div>
</template>
