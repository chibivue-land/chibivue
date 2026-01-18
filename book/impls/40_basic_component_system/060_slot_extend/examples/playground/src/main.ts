import { createApp, defineComponent, h } from "chibivue";

const MyComponent = defineComponent({
  setup(_, { slots }) {
    return () =>
      h("div", {}, [
        slots.default?.(),
        h("br", {}, []),
        slots.myNamedSlot?.(),
        h("br", {}, []),
        slots.myScopedSlot2?.({ message: "hello!" }),
      ]);
  },
});

const app = createApp({
  setup() {
    return () =>
      h(
        MyComponent,
        {},
        {
          default: () => "hello",
          myNamedSlot: () => "hello2",
          myScopedSlot2: (scope: { message: string }) => `message: ${scope.message}`,
        },
      );
  },
});

app.mount("#app");
