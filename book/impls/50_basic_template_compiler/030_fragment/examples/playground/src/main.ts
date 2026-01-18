import { Fragment, createApp, defineComponent, h, ref } from "chibivue";

// const App = defineComponent({
//   template: `<header>header</header>
//   <main>main</main>
//   <footer>footer</footer>`,
// });

const App = defineComponent({
  setup() {
    const list = ref([0]);
    const update = () => {
      list.value = [...list.value, list.value.length];
    };
    return () =>
      h(Fragment, {}, [
        h("button", { onClick: update }, "update"),
        ...list.value.map((i) => h("div", {}, i)),
      ]);
  },
});

const app = createApp(App);

app.mount("#app");
