import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { createApp, h } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("50_basic_template_compiler/060_resolve_components", () => {
  it("should resolve and render components", () => {
    const Child = {
      template: `<span>child</span>`,
    };

    const app = createApp({
      components: { Child },
      template: `<div><Child /></div>`,
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div><span>child</span></div>");
  });
});
