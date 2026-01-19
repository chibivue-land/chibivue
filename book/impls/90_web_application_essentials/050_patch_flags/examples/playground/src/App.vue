<script setup>
import { ref } from 'chibivue'

const message = ref('Hello')
const color = ref('red')
const count = ref(0)
</script>

<template>
  <div class="container">
    <h2>Patch Flags Example</h2>

    <!-- TEXT flag: only text content is dynamic -->
    <p>{{ message }}</p>

    <!-- CLASS flag: only class binding is dynamic -->
    <div :class="{ active: count > 0 }">Class binding (count > 0)</div>

    <!-- STYLE flag: only style binding is dynamic -->
    <span :style="{ color: color }">Styled text ({{ color }})</span>

    <!-- PROPS flag: props are dynamic -->
    <input :value="message" @input="message = $event.target.value" />

    <div class="controls">
      <button @click="count++">Increment ({{ count }})</button>
      <button @click="color = color === 'red' ? 'blue' : 'red'">Toggle color</button>
    </div>
  </div>
</template>

<style>
.container {
  padding: 16px;
}
.active {
  background-color: #42b883;
  color: white;
  padding: 4px 8px;
}
.controls {
  margin-top: 16px;
}
button {
  margin-right: 8px;
}
</style>
