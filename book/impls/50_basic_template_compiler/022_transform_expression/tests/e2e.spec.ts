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

describe("50_basic_template_compiler/022_transform_expression", () => {
  it("should transform expressions in template", () => {
    const app = createApp({
      setup() {
        const state = reactive({ count: 5 });
        return { state };
      },
      template: `<div>count: {{ state.count }}</div>`,
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>count: 5</div>");
  });
});
