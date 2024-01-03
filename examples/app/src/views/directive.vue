<script>
import { ref } from "chibivue";
</script>

<script setup>
// for v-on
const handleClick = () => {
  alert("clicked");
};

// for v-bind
const style = { color: "#876432", fontSize: "30px", "font-weight": "bold" };

// for v-for
const list = [
  { id: 1, text: "foo" },
  { id: 2, text: "bar" },
  { id: 3, text: "baz" },
];

// for v-model
const input = ref("");
</script>

<template>
  <div id="pages-directives">
    <h1>directives</h1>

    <h3>v-on</h3>
    <button @click="handleClick">click me</button>
    <hr />

    <h3>v-bind</h3>
    <div :style="style">hello</div>
    <hr />

    <h3>v-for</h3>
    <ul>
      <li v-for="(item, i) in list" :key="item.id">
        <p>text: {{ item.text }}, index: {{ i }}</p>
      </li>
    </ul>
    <hr />

    <h3>v-model</h3>
    <label>
      Input Data
      <input v-model="input" />
    </label>
    <p>value: "{{ input }}"</p>
  </div>
</template>

<style>
#pages-directives button {
  font-family: "Hannotate SC";
  border: none;
  padding: 8px;
  width: 200px;
  background: #92b5a9;
  color: #fff;
  font-weight: 900;
  font-size: 1rem;
  border-radius: 4px;
}
#pages-directives button:hover {
  opacity: 0.8;
}

#pages-directives li {
  list-style: none;
}
</style>
