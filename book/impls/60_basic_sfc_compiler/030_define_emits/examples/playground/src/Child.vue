<script setup>
const emit = defineEmits(['increment', 'custom-event'])

const handleClick = () => {
  emit('increment')
}

const sendCustomEvent = () => {
  emit('custom-event', 'Hello from child!')
}
</script>

<template>
  <div class="child">
    <h3>Child Component</h3>
    <button @click="handleClick">Emit increment</button>
    <button @click="sendCustomEvent">Emit custom event</button>
  </div>
</template>

<style>
.child {
  padding: 16px;
  background-color: #f0f0f0;
  border-radius: 4px;
  margin: 8px 0;
}
button {
  margin-right: 8px;
}
</style>
