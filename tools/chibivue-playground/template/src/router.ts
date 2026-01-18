// @ts-nocheck
import { createRouter, createWebHistory } from "chibivue-router";
import Counter from "./views/counter.vue";
import CounterStore from "./views/store.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Counter },
    { path: "/store", component: CounterStore },
  ],
});
