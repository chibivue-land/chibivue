<script>
import { defineComponent, ref } from 'chibivue'
import CompilerMacroDemo from '../components/CompilerMacroDemo.vue'

export default defineComponent({
  components: { CompilerMacroDemo },

  setup() {
    const message = ref('hello world')
    const handleClick = (...args) => {
      message.value = args.join(' ')
    }
    return { message, handleClick }
  },
})
</script>

<template>
  <div id="compiler-macro">
    <h1>compiler macro</h1>
    <CompilerMacroDemo :message="message" @click:compiler-macro="handleClick" />
  </div>
</template>

<style>
#compiler-macro button {
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
#compiler-macro button:hover {
  opacity: 0.8;
}
</style>
