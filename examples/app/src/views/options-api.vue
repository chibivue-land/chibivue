<script>
import { defineComponent } from 'chibivue'

export default defineComponent({
  data() {
    return {
      count: 0,
    }
  },
  methods: {
    increment() {
      this.count++
    },
    reset() {
      this.count = 0
    },
  },
  computed: {
    double() {
      return this.count * 2
    },
  },
})
</script>

<template>
  <div id="pages-options-api">
    <h1>options api</h1>
    <p>count: {{ count }}</p>
    <p>double: {{ double }}</p>
    <button @click="increment">increment</button>
    <button @click="reset">reset</button>
  </div>
</template>

<style>
#pages-options-api button {
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
#pages-options-api button:hover {
  opacity: 0.8;
}
</style>
