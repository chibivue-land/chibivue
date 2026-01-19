<script setup>
import { ref } from 'chibivue'

const count = ref(0)
</script>

<template>
  <div class="container">
    <h2>Static Hoisting Example</h2>

    <!-- Static content (hoisted) -->
    <div class="static-content">
      <h3>This is static content</h3>
      <p>Static elements are hoisted out of render function for performance</p>
      <ul>
        <li>Static item 1</li>
        <li>Static item 2</li>
        <li>Static item 3</li>
      </ul>
    </div>

    <!-- Dynamic content -->
    <div class="dynamic-content">
      <p>Count: {{ count }}</p>
      <button @click="count++">Increment</button>
    </div>
  </div>
</template>

<style>
.container {
  padding: 16px;
}
.static-content {
  background-color: #f0f0f0;
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 4px;
}
.dynamic-content {
  background-color: #e0f0e0;
  padding: 16px;
  border-radius: 4px;
}
</style>
