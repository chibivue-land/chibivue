<script>
import { reactive, toRef } from 'chibivue'

export default {
  setup() {
    const state = reactive({
      name: 'chibivue',
      count: 0,
    })

    // Create ref that syncs with reactive property
    const nameRef = toRef(state, 'name')
    const countRef = toRef(state, 'count')

    const updateName = () => {
      nameRef.value = 'updated chibivue'
    }

    const incrementCount = () => {
      countRef.value++
    }

    return { state, nameRef, countRef, updateName, incrementCount }
  },
}
</script>

<template>
  <div class="container">
    <h2>toRef Example</h2>

    <h3>From reactive object</h3>
    <p>state.name: {{ state.name }}</p>
    <p>state.count: {{ state.count }}</p>

    <h3>Via toRef</h3>
    <p>nameRef: {{ nameRef }}</p>
    <p>countRef: {{ countRef }}</p>

    <button @click="updateName">Update via nameRef</button>
    <button @click="incrementCount">Increment via countRef</button>
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
