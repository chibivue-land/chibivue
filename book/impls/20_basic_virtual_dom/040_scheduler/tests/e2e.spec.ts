import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, h, reactive } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("20_basic_virtual_dom/040_scheduler", () => {
  it("should batch multiple updates in scheduler", async () => {
    const state = reactive({ count: 0 });
    const app = createApp({
      setup() {
        return () => h("div", {}, [`count: ${state.count}`]);
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>count: 0</div>");

    // Multiple synchronous updates should be batched
    state.count++;
    state.count++;
    state.count++;

    // DOM should not update synchronously
    expect(host.innerHTML).toBe("<div>count: 0</div>");

    // Wait for scheduler to flush
    await Promise.resolve();
    expect(host.innerHTML).toBe("<div>count: 3</div>");
  });
});
