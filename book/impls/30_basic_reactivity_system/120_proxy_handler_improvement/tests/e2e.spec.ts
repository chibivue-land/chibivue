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

describe("30_basic_reactivity_system/120_proxy_handler_improvement", () => {
  it("should handle array methods correctly", async () => {
    const state = reactive({ items: [1, 2, 3] });
    const app = createApp({
      setup() {
        return () => h("div", {}, [state.items.join(",")]);
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>1,2,3</div>");

    state.items.push(4);
    await Promise.resolve();
    expect(host.innerHTML).toBe("<div>1,2,3,4</div>");
  });
});
