import { createApp } from "chibivue";

// @ts-expect-error
import App from "./App.vue";

const app = createApp(App);

app.mount("#app");
