<script setup lang="ts">
// Type-based props definition
const props = defineProps<{
  message: string
  count: number
}>()

// Type-based emits definition
const emit = defineEmits<{
  (e: 'update', payload: { message: string; count: number }): void
}>()

const sendUpdate = () => {
  emit('update', { message: props.message, count: props.count })
}
</script>

<template>
  <div class="child">
    <h3>Child Component (Type-based Macros)</h3>
    <p>Message: {{ props.message }}</p>
    <p>Count: {{ props.count }}</p>
    <button @click="sendUpdate">Emit update</button>
  </div>
</template>

<style>
.child {
  padding: 16px;
  background-color: #f0f0f0;
  border-radius: 4px;
  margin: 8px 0;
}
</style>
