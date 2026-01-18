<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const msg = ref('Hello, chibivue!')
    const rawHtml = ref('<span style="color: red">Red text</span>')
    return { msg, rawHtml }
  },
}
</script>

<template>
  <div>
    <h2>v-text</h2>
    <span v-text="msg"></span>

    <h2>v-html</h2>
    <div v-html="rawHtml"></div>

    <h2>v-pre</h2>
    <span v-pre>{{ msg }} will not be compiled</span>
  </div>
</template>
