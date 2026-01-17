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

describe("20_basic_virtual_dom/010_patch_keyed_children", () => {
  it("should patch keyed children correctly", async () => {
    const state = reactive({ list: [1, 2, 3] });
    const app = createApp({
      setup() {
        return () =>
          h(
            "ul",
            {},
            state.list.map((item) => h("li", { key: item }, [String(item)])),
          );
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe(
      '<ul><li key="1">1</li><li key="2">2</li><li key="3">3</li></ul>',
    );

    state.list = [3, 2, 1];
    await Promise.resolve();
    expect(host.innerHTML).toBe(
      '<ul><li key="3">3</li><li key="2">2</li><li key="1">1</li></ul>',
    );
  });
});
