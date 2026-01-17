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

describe("30_basic_reactivity_system/100_reactive_proxy_target_type", () => {
  it("should return original for invalid target types (Map/Set)", () => {
    // At this stage, Map and Set are not yet supported and return original
    const map = new Map([["count", 0]]);
    const reactiveMap = reactive(map);
    expect(reactiveMap).toBe(map);

    const set = new Set([1, 2, 3]);
    const reactiveSet = reactive(set);
    expect(reactiveSet).toBe(set);
  });

  it("should handle Object reactively", async () => {
    const state = reactive({ count: 0 });
    const app = createApp({
      setup() {
        return () => h("div", {}, [`count: ${state.count}`]);
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>count: 0</div>");

    state.count = 1;
    await Promise.resolve();
    expect(host.innerHTML).toBe("<div>count: 1</div>");
  });

  it("should handle Array reactively", async () => {
    const state = reactive({ items: [1, 2, 3] });
    const app = createApp({
      setup() {
        return () => h("div", {}, [state.items.join(",")]);
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>1,2,3</div>");

    // Direct assignment works at this stage
    state.items = [1, 2, 3, 4];
    await Promise.resolve();
    expect(host.innerHTML).toBe("<div>1,2,3,4</div>");
  });
});
