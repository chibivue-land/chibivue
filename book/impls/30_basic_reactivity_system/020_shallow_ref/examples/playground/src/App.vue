<script>
import { ref, shallowRef } from 'chibivue'

export default {
  setup() {
    const deepRef = ref({ nested: { count: 0 } })
    const shallow = shallowRef({ nested: { count: 0 } })

    const updateDeep = () => {
      deepRef.value.nested.count++
    }

    const updateShallow = () => {
      // This won't trigger re-render
      shallow.value.nested.count++
    }

    const replaceShallow = () => {
      // This will trigger re-render
      shallow.value = { nested: { count: shallow.value.nested.count + 1 } }
    }

    return { deepRef, shallow, updateDeep, updateShallow, replaceShallow }
  },
}
</script>

<template>
  <div class="container">
    <h2>shallowRef Example</h2>

    <div>
      <h3>Deep ref</h3>
      <p>Count: {{ deepRef.nested.count }}</p>
      <button @click="updateDeep">Update nested (triggers)</button>
    </div>

    <div>
      <h3>Shallow ref</h3>
      <p>Count: {{ shallow.nested.count }}</p>
      <button @click="updateShallow">Update nested (no trigger)</button>
      <button @click="replaceShallow">Replace value (triggers)</button>
    </div>
  </div>
</template>

<style>
.container {
  padding: 16px;
}
button {
  margin-right: 8px;
}
</style>
