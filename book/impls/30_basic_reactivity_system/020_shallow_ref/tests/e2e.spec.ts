import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, h, shallowRef, triggerRef } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("30_basic_reactivity_system/020_shallow_ref", () => {
  it("should not trigger updates for deep changes with shallowRef", async () => {
    const state = shallowRef({ count: 0 });
    const app = createApp({
      setup() {
        return () => h("div", {}, [`count: ${state.value.count}`]);
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>count: 0</div>");

    // Deep change should not trigger update
    state.value.count = 1;
    await Promise.resolve();
    expect(host.innerHTML).toBe("<div>count: 0</div>");

    // triggerRef should force update
    triggerRef(state);
    await Promise.resolve();
    expect(host.innerHTML).toBe("<div>count: 1</div>");
  });
});
