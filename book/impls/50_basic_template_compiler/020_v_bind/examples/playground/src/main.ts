import { createApp, defineComponent } from "chibivue";

const App = defineComponent({
  setup() {
    const bind = { id: "some-id", class: "some-class", style: "color: red" };
    return { count: 1, bind };
  },

  template: `<div>
  <p v-bind:id="count"> v-bind:id="count" </p>
  <p :id="count * 2"> :id="count * 2" </p>

  <p v-bind:["style"]="bind.style"> v-bind:["style"]="bind.style" </p>
  <p :["style"]="bind.style"> :["style"]="bind.style" </p>

  <p v-bind="bind"> v-bind="bind" </p>

  <p :style="{ 'font-weight': 'bold' }"> :style="{ font-weight: 'bold' }" </p>
  <p :style="'font-weight: bold;'"> :style="'font-weight: bold;'" </p>
  <p :class="'my-class my-class2'"> :class="'my-class my-class2'" </p>
  <p :class="['my-class']"> :class="['my-class']" </p>
  <p :class="{ 'my-class': true }"> :class="{ 'my-class': true }" </p>
  <p :class="{ 'my-class': false }"> :class="{ 'my-class': false }" </p>
</div>`,
});

const app = createApp(App);

app.mount("#app");
