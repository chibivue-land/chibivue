import { createApp } from "vue";
import "./style.css";
// @ts-expect-error
import App from "./App.vue";
import "./plugin.sample.js";

createApp(App).mount("#app");
