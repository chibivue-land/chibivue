import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, reactive } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("10_minimum_example/060_template_compiler3", () => {
  it("should render with template and mustache binding", () => {
    const state = reactive({ message: "Hello chibivue!" });
    const app = createApp({
      setup() {
        return { state };
      },
      template: `<div>{{ state.message }}</div>`,
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>Hello chibivue!</div>");
  });
});
