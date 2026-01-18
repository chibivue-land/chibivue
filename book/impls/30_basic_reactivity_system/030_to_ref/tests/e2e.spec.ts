import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, h, reactive, toRef } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("30_basic_reactivity_system/030_to_ref", () => {
  it("should create ref from reactive property", async () => {
    const state = reactive({ count: 0 });
    const countRef = toRef(state, "count");
    const app = createApp({
      setup() {
        return () => h("div", {}, [`count: ${countRef.value}`]);
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>count: 0</div>");

    state.count++;
    await Promise.resolve();
    expect(host.innerHTML).toBe("<div>count: 1</div>");
  });
});
