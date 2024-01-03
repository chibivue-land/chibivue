<script>
import { defineComponent } from 'chibivue'

import Counter from './components/Counter.vue'

export default defineComponent({
  components: { Counter },
})
</script>

<template>
  <Counter />
  <Counter />
  <GlobalCounter />
</template>
