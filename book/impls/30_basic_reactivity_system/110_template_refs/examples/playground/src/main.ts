import { createApp, h, ref } from "chibivue";

const Child = {
  setup() {
    const action = () => alert("clicked!");
    return { action };
  },

  template: `<button @click="action">action (child)</button>`,
};

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null);
    const focus = () => {
      inputRef.value?.focus();
    };

    const childRef = ref<any>(null);
    const childAction = () => {
      childRef.value?.action();
    };

    return () =>
      h("div", {}, [
        h("input", { ref: inputRef }, []),
        h("button", { onClick: focus }, ["focus"]),
        h("hr", {}, []),
        h("div", {}, [
          h(Child, { ref: childRef }, []),
          h("button", { onClick: childAction }, ["action (parent)"]),
        ]),
      ]);
  },
});

app.mount("#app");
