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

describe("50_basic_template_compiler/010_transformer", () => {
  it("should compile and render template", () => {
    const app = createApp({
      template: `<div>Hello World</div>`,
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>Hello World</div>");
  });
});
