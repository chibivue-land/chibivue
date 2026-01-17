import { createApp, defineComponent, ref } from "chibivue";

const App = defineComponent({
  setup() {
    const n = ref(1);
    const inc = () => {
      n.value++;
    };

    return { n, inc };
  },

  template: `
    <button @click="inc">inc</button>
    <p v-if="n % 5 === 0 && n % 3 === 0">FizzBuzz</p>
    <p v-else-if="n % 5 === 0">Buzz</p>
    <p v-else-if="n % 3 === 0">Fizz</p>
    <p v-else>{{ n }}</p>
  `,
});

const app = createApp(App);

app.mount("#app");
