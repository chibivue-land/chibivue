<script setup lang="ts">
import { ref } from 'vue'
const count = ref(0)
</script>

<template>
  <div>
    <p>{{ count }}</p>
    <button @click="count++">increment</button>
  </div>
</template>

<style></style>
