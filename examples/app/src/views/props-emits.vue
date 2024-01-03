<script>
import { defineComponent, reactive } from 'chibivue'
import SimpleCard from '../components/SimpleCard.vue'
import SimpleBtn from '../components/SimpleBtn.vue'

export default defineComponent({
  components: { SimpleCard, SimpleBtn },
  setup() {
    const card = reactive({
      title: 'Hello World',
      content: 'This is a simple card',
    })

    const changeTitle = () => {
      card.title =
        card.title === 'Hello World!!!!!!!!!!!'
          ? 'Hello World??????????'
          : 'Hello World!!!!!!!!!!!'
    }

    return { card, changeTitle }
  },
})
</script>

<template>
  <div id="pages-props-emit">
    <h1>props/emits</h1>
    <SimpleCard :card="card" />
    <SimpleBtn text="Change Title" @click:simple-btn="changeTitle" />
  </div>
</template>

<style>
#pages-props-emit button {
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
#pages-props-emit button:hover {
  opacity: 0.8;
}
</style>
