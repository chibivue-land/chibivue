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

describe("30_basic_reactivity_system/010_ref", () => {
  it("should render with ref", async () => {
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
