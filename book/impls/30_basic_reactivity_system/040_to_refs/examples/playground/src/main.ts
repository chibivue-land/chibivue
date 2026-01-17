import { createApp, h, reactive, toRefs } from "chibivue";

const app = createApp({
  setup() {
    const state = reactive({ foo: 1, bar: 2 });
    const stateAsRefs = toRefs(state);

    return () =>
      h("div", {}, [
        h("p", {}, [`[state]: foo: ${state.foo}, bar: ${state.bar}`]),
        h("p", {}, [`[stateAsRefs]: foo: ${stateAsRefs.foo.value}, bar: ${stateAsRefs.bar.value}`]),
        h("button", { onClick: () => state.foo++ }, ["update state.foo"]),
        h("button", { onClick: () => stateAsRefs.bar.value++ }, ["update stateAsRefs.bar.value"]),
      ]);
  },
});

app.mount("#app");
