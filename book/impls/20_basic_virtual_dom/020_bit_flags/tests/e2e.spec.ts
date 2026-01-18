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

describe("20_basic_virtual_dom/020_bit_flags", () => {
  it("should render and update with bit flags optimization", async () => {
    const state = reactive({ count: 0 });
    const app = createApp({
      setup() {
        return () => h("div", {}, [`count: ${state.count}`]);
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>count: 0</div>");

    state.count++;
    await Promise.resolve();
    expect(host.innerHTML).toBe("<div>count: 1</div>");
  });
});
