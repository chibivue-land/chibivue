import { createApp, defineComponent, ref } from "chibivue";

const App = defineComponent({
  setup() {
    const count = ref(0);
    const increment = (e: Event) => {
      console.log(e);
      count.value++;
    };
    return { count, increment };
  },

  template: `<div>
    <p>count: {{ count }}</p>

    <button v-on:click="increment">v-on:click="increment"</button>
    <button @click="increment">@click="increment"</button>
    <button v-on="{ click: increment }">v-on="{ click: increment }"</button>
    <button v-on:['click']="increment">v-on:['click']="increment"</button>
    
    <button @click="count++">@click="count++"</button>
    <button @click="() => count++">@click="() => count++"</button>
    <button @click="increment($event)">@click="increment($event)"</button>
    <button @click="e => increment(e)">@click="e => increment(e)"</button>
</div>`,
});

const app = createApp(App);

app.mount("#app");
