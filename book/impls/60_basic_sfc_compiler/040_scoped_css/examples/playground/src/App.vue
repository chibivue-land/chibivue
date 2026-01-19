<script setup>
import { ref } from 'chibivue'
import ChildComponent from './Child.vue'

const message = ref('Hello from App!')
</script>

<template>
  <div class="container">
    <h2>Scoped CSS Example</h2>
    <p class="styled-text">{{ message }}</p>
    <p class="red-text">This text is styled with scoped CSS (red)</p>
    <ChildComponent />
  </div>
</template>

<style scoped>
.container {
  padding: 16px;
  border: 2px solid #42b883;
}
.styled-text {
  color: #42b883;
  font-weight: bold;
}
.red-text {
  color: red;
}
</style>
