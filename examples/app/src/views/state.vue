<script>
import { ref, reactive, computed } from 'chibivue'
</script>

<script setup>
const count = ref(0)
const increment = () => {
  count.value++
}

const count2 = reactive({ value: 0 })
const increment2 = () => {
  count2.value++
}

const double = computed(() => count.value * 2)
</script>

<template>
  <div id="pages-state">
    <h1>state</h1>
    <p>count: {{ count }} (ref)</p>
    <p>double: {{ double }} (ref)</p>
    <p>count: {{ count2.value }} (reactive)</p>
    <button @click="increment">increment (ref)</button>
    <button @click="increment2">increment (reactive)</button>
  </div>
</template>

<style>
#pages-state button {
  font-family: 'Hannotate SC';
  border: none;
  padding: 8px;
  width: 200px;
  background: #92b5a9;
  color: #fff;
  font-weight: 900;
  font-size: 1rem;
  border-radius: 4px;
}
#pages-state button:hover {
  opacity: 0.8;
}
</style>
