<script setup>
import { useCounterStore } from '../store/counter'
const { count, increment } = useCounterStore()
</script>

<template>
  <div id="pages-counter-store">
    <h1>Counter Store</h1>
    <button @click="increment">increment</button>
    <p>{{ count }}</p>
  </div>
</template>
