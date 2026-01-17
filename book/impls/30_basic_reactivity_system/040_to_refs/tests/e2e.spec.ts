import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, h, reactive, toRefs } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("30_basic_reactivity_system/040_to_refs", () => {
  it("should create refs from reactive object", async () => {
    const state = reactive({ count: 0, name: "test" });
    const { count, name } = toRefs(state);
    const app = createApp({
      setup() {
        return () => h("div", {}, [`${name.value}: ${count.value}`]);
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>test: 0</div>");

    state.count++;
    await Promise.resolve();
    expect(host.innerHTML).toBe("<div>test: 1</div>");
  });
});
