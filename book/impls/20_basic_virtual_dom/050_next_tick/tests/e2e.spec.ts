import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, h, nextTick, reactive } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("20_basic_virtual_dom/050_next_tick", () => {
  it("should update DOM after nextTick", async () => {
    const state = reactive({ count: 0 });
    const app = createApp({
      setup() {
        return () => h("div", {}, [`count: ${state.count}`]);
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>count: 0</div>");

    state.count++;
    await nextTick();
    expect(host.innerHTML).toBe("<div>count: 1</div>");
  });
});
