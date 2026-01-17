import { type Ref, effect, h, inject, onBeforeMount, onMounted, ref } from "chibivue";

import {
  type VaporComponent,
  createComponent,
  on,
  setText,
  template,
} from "@chibivue/runtime-vapor";

// @ts-expect-error
import Counter from "./Counter.vue";

const t0 = () => template('<div><button id="btn-on-vapor">');

const t1 = () => template('<button id="parent-count-incrementor">parent-count-incrementor');

export default ((self: any) => {
  /*
   *
   * compiled from scripts
   *
   */
  const count = ref(0);

  const appVueCount = inject<Ref<number>>("App.vue count")!;

  onBeforeMount(() => {
    console.log("before mount", document.getElementById("btn-on-vapor"));
  });

  onMounted(() => {
    console.log("mounted", document.getElementById("btn-on-vapor"));
  });

  /*
   *
   * compiled from template
   *
   */
  const div = t0();

  const button0 = div.firstChild as Element;
  const _button_text = "MyComponent.vapor (in App.vue) {}";
  effect(() => {
    setText(button0, _button_text, count.value);
  });
  on(button0, "click", () => count.value++);

  const button1 = t1();
  on(button1, "click", () => appVueCount.value++);
  div.insertBefore(button1, button0.nextSibling);

  createComponent(self, h(Counter, null, []), div);

  return div;
}) satisfies VaporComponent;
