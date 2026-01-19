<script setup>
</script>

<template>
  <div class="child">
    <h3>Child Component</h3>
    <p class="styled-text">This text uses the same class but is in a different component</p>
    <p class="red-text">This red-text class is defined in parent's scoped CSS</p>
  </div>
</template>

<style scoped>
.child {
  padding: 16px;
  background-color: #e0e0e0;
  border-radius: 4px;
  margin: 8px 0;
}
.styled-text {
  color: blue;
  font-style: italic;
}
</style>
