<script setup>
const props = defineProps({
  message: String,
  count: Number,
})
</script>

<template>
  <div class="child">
    <h3>Child Component</h3>
    <p>Message: {{ props.message }}</p>
    <p>Count: {{ props.count }}</p>
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
