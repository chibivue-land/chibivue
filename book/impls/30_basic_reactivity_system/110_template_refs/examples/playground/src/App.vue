<script>
import { ref, onMounted } from 'chibivue'

export default {
  setup() {
    // Template ref
    const inputRef = ref(null)
    const divRef = ref(null)

    const focusInput = () => {
      inputRef.value?.focus()
    }

    const logDivContent = () => {
      if (divRef.value) {
        console.log('Div content:', divRef.value.textContent)
        alert('Check console for div content!')
      }
    }

    onMounted(() => {
      console.log('Input element:', inputRef.value)
      console.log('Div element:', divRef.value)
    })

    return { inputRef, divRef, focusInput, logDivContent }
  },
}
</script>

<template>
  <div class="container">
    <h2>Template Refs Example</h2>

    <div>
      <input ref="inputRef" placeholder="Focus me with the button" />
      <button @click="focusInput">Focus Input</button>
    </div>

    <div ref="divRef" class="content-box">
      This is a div with a template ref. Click the button to log its content.
    </div>
    <button @click="logDivContent">Log Div Content</button>
  </div>
</template>

<style>
.container {
  padding: 16px;
}
.content-box {
  margin: 16px 0;
  padding: 16px;
  background-color: #f0f0f0;
  border-radius: 4px;
}
button {
  margin-right: 8px;
}
</style>
