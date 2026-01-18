import { computed, createApp, defineComponent, h, ref } from "chibivue";

const CountInjectionKey = Symbol();

const Child = defineComponent({
  inject: {
    injectedCount: { from: CountInjectionKey },
  },

  emits: { "update:count": null },

  render(ctx) {
    return h("div", {}, [
      h("button", { onClick: () => ctx.$emit("update:count") }, ["update count"]),
      `injected: ${ctx.injectedCount}`,
    ]);
  },
});

const App = defineComponent({
  setup() {
    const count = ref(0);
    return { count };
  },

  data() {
    return { count2: 0 };
  },

  computed: {
    double() {
      return this.count2 * 2;
    },
  },

  methods: {
    hello() {
      this.count2++;
    },
  },

  watch: {
    count2() {
      console.log(`count2 changed: ${this.count2}`);
    },
  },

  created() {
    console.log("created");
  },

  beforeMount() {
    console.log("beforeMount");
  },

  mounted() {
    console.log("mounted");
  },

  beforeUpdate() {
    console.log("beforeUpdate");
  },

  updated() {
    console.log("updated");
  },

  beforeUnmount() {
    console.log("beforeUnmount");
  },

  unmounted() {
    console.log("unmounted");
  },

  render(ctx) {
    return h("div", {}, [
      h("button", { onClick: ctx.hello }, ["hello"]),
      h("br", {}, []),
      `${ctx.count2}\n`,
      h("br", {}, []),
      `${ctx.count}\n`,
      h("br", {}, []),
      h(Child, { "onUpdate:count": () => ctx.count2++ }, []),
    ]);
  },

  provide() {
    return { [CountInjectionKey]: computed(() => this.count2) };
  },
});

const app = createApp(App);

app.mount("#app");
