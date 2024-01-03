<script>
import { defineComponent, ref, provide } from 'chibivue'
import MyVaporComponent from './MyComponent.vapor'

export default defineComponent({
  components: { MyVaporComponent },
  setup() {
    const count = ref(0)
    provide('App.vue count', count)
    return { count }
  },
})
</script>

<template>
  <div>
    <button @click="count++">App.vue {{ count }}</button>
    <MyVaporComponent />
  </div>
</template>
