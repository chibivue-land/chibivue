<script setup>
import { ref, Transition } from 'chibivue'

const show = ref(true)
const toggle = () => {
  show.value = !show.value
}
</script>

<template>
  <div class="container">
    <h2>Transition Example</h2>
    <button @click="toggle">Toggle</button>

    <Transition name="fade">
      <div v-if="show" class="box">
        This content will fade in/out
      </div>
    </Transition>
  </div>
</template>

<style>
.container {
  padding: 16px;
}
.box {
  padding: 16px;
  background-color: #42b883;
  color: white;
  margin-top: 16px;
  border-radius: 4px;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
