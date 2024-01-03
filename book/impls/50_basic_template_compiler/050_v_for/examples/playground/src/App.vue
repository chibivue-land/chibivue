<script>
import { createApp, defineComponent, ref } from 'chibivue'

const genId = () => Math.random().toString(36).slice(2)

const FRUITS_FACTORIES = [
  () => ({ id: genId(), name: 'apple', color: 'red' }),
  () => ({ id: genId(), name: 'banana', color: 'yellow' }),
  () => ({ id: genId(), name: 'grape', color: 'purple' }),
]

export default {
  setup() {
    const fruits = ref([...FRUITS_FACTORIES].map(f => f()))
    const addFruit = () => {
      fruits.value.push(
        FRUITS_FACTORIES[Math.floor(Math.random() * FRUITS_FACTORIES.length)](),
      )
    }
    return { fruits, addFruit }
  },
}
</script>

<template>
  <button @click="addFruit">add fruits!</button>

  <!-- basic -->
  <ul>
    <li v-for="fruit in fruits" :key="fruit.id">
      <span :style="{ backgroundColor: fruit.color }">{{ fruit.name }}</span>
    </li>
  </ul>

  <!-- indexed -->
  <ul>
    <li v-for="(fruit, i) in fruits" :key="fruit.id">
      <span :style="{ backgroundColor: fruit.color }">{{ fruit.name }}</span>
    </li>
  </ul>

  <!-- destructuring -->
  <ul>
    <li v-for="({ id, name, color }, i) in fruits" :key="id">
      <span :style="{ backgroundColor: color }">{{ name }}</span>
    </li>
  </ul>

  <!-- object -->
  <ul>
    <li v-for="(value, key, idx) in fruits[0]" :key="key">
      [{{ idx }}] {{ key }}: {{ value }}
    </li>
  </ul>

  <!-- range -->
  <ul>
    <li v-for="n in 10">{{ n }}</li>
  </ul>

  <!-- string -->
  <ul>
    <li v-for="c in 'hello'">{{ c }}</li>
  </ul>

  <!-- nested -->
  <ul>
    <li v-for="({ id, name, color }, i) in fruits" :key="id">
      <span :style="{ backgroundColor: color }">
        <span v-for="n in 3">{{ n }}</span>
        {{ name }}</span
      >
    </li>
  </ul>
</template>
