import { createApp, h, ref, watchEffect } from "chibivue";

const app = createApp({
  setup() {
    const count = ref(0);

    watchEffect(() => console.log(count.value));

    return () =>
      h("div", {}, [
        h("p", {}, [`count: ${count.value}`]),
        h("button", { onClick: () => count.value++ }, ["update count"]),
      ]);
  },
});

app.mount("#app");
