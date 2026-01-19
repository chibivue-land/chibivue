<script setup>
// Props destructure - extract props directly
const { title, count = 0 } = defineProps({
  title: String,
  count: Number,
})
</script>

<template>
  <div class="child">
    <h3>Child Component (Props Destructure)</h3>
    <p>Title: {{ title }}</p>
    <p>Count: {{ count }}</p>
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
