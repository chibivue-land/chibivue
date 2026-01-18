import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, h, ref } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("40_basic_component_system/030_component_proxy", () => {
  it("should access setup return values through component proxy", async () => {
    const count = ref(0);
    const app = createApp({
      setup() {
        return () => h("div", {}, [`count: ${count.value}`]);
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>count: 0</div>");

    count.value++;
    await Promise.resolve();
    expect(host.innerHTML).toBe("<div>count: 1</div>");
  });
});
