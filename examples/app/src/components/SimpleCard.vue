<script>
export default {
  props: {
    card: { type: Object },
  },
  setup(props) {},
}
</script>

<template>
  <div style="border: 1px solid #ccc; padding: 10px; margin: 10px">
    <h3>{{ card.title }}</h3>
    <p>{{ card.content }}</p>
  </div>
</template>
