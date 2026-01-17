import { createApp, h, reactive } from "chibivue";

const app = createApp({
  setup() {
    const state = reactive({
      message: "Hello World",
    });
    const updateList = () => {
      state.message = "Hello ChibiVue!";
      state.message = "Hello ChibiVue!!";
      state.message = "Hello ChibiVue!!";
      state.message = "Hello ChibiVue!!";
      state.message = "Hello ChibiVue!!";
      state.message = "Hello ChibiVue!! last";
    };

    return () => {
      console.log("😎 rendered!");
      return h("div", { id: "app" }, [
        h("p", {}, [`message: ${state.message}`]),
        h("button", { onClick: updateList }, ["update"]),
      ]);
    };
  },
});

app.mount("#app");
