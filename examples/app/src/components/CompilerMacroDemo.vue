<script setup>
const props = defineProps({
  message: { type: String, default: 'Hello World' },
})

const emit = defineEmits({ 'click:compiler-macro': null })

const invokeEmit = () => {
  console.log('props.message: ', props)
  emit('click:compiler-macro', 'Hello from CompilerMacroDemo')
}
</script>

<template>
  <div>
    <p>{{ message }} (children)</p>
    <button @click="invokeEmit">emit</button>
  </div>
</template>
