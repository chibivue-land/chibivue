<!-- button component (emit only) -->
<script>
export default {
  props: {
    text: { type: String },
  },
  setup(_, { emit }) {
    const handleClick = () => {
      emit('click:simple-btn', 'Hello from SimpleBtn')
    }
    return { handleClick }
  },
}
</script>

<template>
  <button @click="handleClick">{{ text }}</button>
</template>
