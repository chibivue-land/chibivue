import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("50_basic_template_compiler/030_fragment", () => {
  it("should render fragment (multiple root elements)", () => {
    const app = createApp({
      template: `<span>first</span><span>second</span>`,
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<span>first</span><span>second</span>");
  });
});
