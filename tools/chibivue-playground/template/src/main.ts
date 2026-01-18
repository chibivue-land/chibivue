// @ts-nocheck
import { createApp } from "chibivue";
import { createStore } from "chibivue-store";
import App from "./App.vue";
import { router } from "./router";

const app = createApp(App);
app.use(router);
app.use(createStore());
app.mount("#app");
