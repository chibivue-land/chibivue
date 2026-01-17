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

describe("30_basic_reactivity_system/050_computed", () => {
  it("should compute derived values", async () => {
    const count = ref(0);
    const doubled = computed(() => count.value * 2);
    const app = createApp({
      setup() {
        return () => h("div", {}, [`doubled: ${doubled.value}`]);
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>doubled: 0</div>");

    count.value = 5;
    await Promise.resolve();
    expect(host.innerHTML).toBe("<div>doubled: 10</div>");
  });
});
