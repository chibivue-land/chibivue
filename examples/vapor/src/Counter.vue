<script setup>
import { ref, inject } from 'chibivue'
const count = ref(0)
const appVueCount = inject('App.vue count')
</script>

<template>
  <div>
    <button @click="count++">
      Counter.vue (in MyComponent.vapor) {{ count }}
    </button>
    <button @click="appVueCount++">parent-count-incrementor</button>
  </div>
</template>
