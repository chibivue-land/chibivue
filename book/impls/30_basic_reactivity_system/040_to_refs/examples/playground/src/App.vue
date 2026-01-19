<script>
import { reactive, toRefs } from 'chibivue'

export default {
  setup() {
    const state = reactive({
      name: 'chibivue',
      count: 0,
      version: '1.0.0',
    })

    // Convert all properties to refs
    const { name, count, version } = toRefs(state)

    const updateName = () => {
      name.value = 'updated chibivue'
    }

    const incrementCount = () => {
      count.value++
    }

    return { state, name, count, version, updateName, incrementCount }
  },
}
</script>

<template>
  <div class="container">
    <h2>toRefs Example</h2>

    <h3>From reactive object</h3>
    <p>state.name: {{ state.name }}</p>
    <p>state.count: {{ state.count }}</p>
    <p>state.version: {{ state.version }}</p>

    <h3>Via destructured toRefs</h3>
    <p>name: {{ name }}</p>
    <p>count: {{ count }}</p>
    <p>version: {{ version }}</p>

    <button @click="updateName">Update name</button>
    <button @click="incrementCount">Increment count</button>
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
