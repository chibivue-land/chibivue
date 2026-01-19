<script>
import { reactive, ref } from 'chibivue'

export default {
  setup() {
    // Object
    const obj = reactive({ count: 0, name: 'chibivue' })

    // Array
    const arr = reactive([1, 2, 3])

    // Map
    const map = reactive(new Map([['key1', 'value1']]))

    // Set
    const set = reactive(new Set([1, 2, 3]))

    const updateObj = () => obj.count++
    const pushArr = () => arr.push(arr.length + 1)
    const setMap = () => map.set(`key${map.size + 1}`, `value${map.size + 1}`)
    const addSet = () => set.add(set.size + 1)

    return { obj, arr, map, set, updateObj, pushArr, setMap, addSet }
  },
}
</script>

<template>
  <div class="container">
    <h2>Reactive Proxy Target Types Example</h2>

    <div>
      <h3>Object</h3>
      <p>{{ obj }}</p>
      <button @click="updateObj">Increment count</button>
    </div>

    <div>
      <h3>Array</h3>
      <p>{{ arr }}</p>
      <button @click="pushArr">Push</button>
    </div>

    <div>
      <h3>Map</h3>
      <p>Size: {{ map.size }}</p>
      <button @click="setMap">Set new entry</button>
    </div>

    <div>
      <h3>Set</h3>
      <p>Size: {{ set.size }}</p>
      <button @click="addSet">Add new value</button>
    </div>
  </div>
</template>

<style>
.container {
  padding: 16px;
}
button {
  margin-right: 8px;
}
</style>
