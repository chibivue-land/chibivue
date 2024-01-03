<script setup>
import { useCounterStore } from '../store/count.store'
const { count: todoMaxLength, increment, reset } = useCounterStore()
</script>

<template>
  <div id="pages-store">
    <h1>store</h1>
    <p>todo max length: {{ todoMaxLength }} (global counter)</p>
    <button @click="increment">increment</button>
    <button @click="reset">reset</button>
  </div>
</template>

<style>
#pages-store button {
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
#pages-store button:hover {
  opacity: 0.8;
}
</style>
