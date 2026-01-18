import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, h } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("40_basic_component_system/070_options_api", () => {
  it("should support options API with methods", () => {
    const app = createApp({
      data() {
        return { count: 0 };
      },
      methods: {
        increment() {
          this.count++;
        },
      },
      template: `<div>count: {{ count }}</div>`,
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>count: 0</div>");
  });
});
