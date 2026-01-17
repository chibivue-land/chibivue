import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, h, inject, provide } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("40_basic_component_system/020_provide_inject", () => {
  it("should provide and inject values", () => {
    const Child = {
      setup() {
        const message = inject<string>("message");
        return () => h("span", {}, [message || "no message"]);
      },
    };

    const app = createApp({
      setup() {
        provide("message", "Hello from parent");
        return () => h("div", {}, [h(Child, {}, [])]);
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div><span>Hello from parent</span></div>");
  });
});
