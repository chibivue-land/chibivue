import { createApp, h, reactive, ref, watch } from "chibivue";

const app = createApp({
  setup() {
    const state = reactive({ count: 0 });
    watch(
      () => state.count,
      (crr, prev) => alert(`state.count was changed! ${prev} -> ${crr}`),
    );

    const count = ref(0);
    watch(count, (crr, prev) => alert(`count.value was changed! ${prev} -> ${crr}`));

    const count2 = ref(0);
    watch([count, count2], (crr, prev) =>
      alert(`count.value or count2.value was changed! ${prev} -> ${crr}`),
    );

    watch(count, () => alert("immediate watcher"), { immediate: true });

    watch(
      () => state,
      () => alert("deep watcher"),
      { deep: true },
    );

    watch(state, () => alert("deep watcher (auto)"));

    return () =>
      h("div", {}, [
        h("p", {}, [`state.count: ${state.count}`]),
        h("button", { onClick: () => state.count++ }, ["update state"]),

        h("p", {}, [`count: ${count.value}`]),
        h("button", { onClick: () => count.value++ }, ["update count"]),

        h("p", {}, [`count2: ${count2.value}`]),
        h("button", { onClick: () => count2.value++ }, ["update count2"]),
      ]);
  },
});

app.mount("#app");
