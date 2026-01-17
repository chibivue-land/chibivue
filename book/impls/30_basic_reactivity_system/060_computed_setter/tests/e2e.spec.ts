import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { computed, createApp, h, ref } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("30_basic_reactivity_system/060_computed_setter", () => {
  it("should support computed setter", async () => {
    const count = ref(0);
    const doubled = computed({
      get: () => count.value * 2,
      set: (val) => {
        count.value = val / 2;
      },
    });
    const app = createApp({
      setup() {
        return () => h("div", {}, [`count: ${count.value}, doubled: ${doubled.value}`]);
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>count: 0, doubled: 0</div>");

    doubled.value = 10;
    await Promise.resolve();
    expect(host.innerHTML).toBe("<div>count: 5, doubled: 10</div>");
  });
});
