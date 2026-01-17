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

describe("50_basic_template_compiler/080_component_slot_outlet", () => {
  it("should render slot outlet", () => {
    const Child = {
      template: `<div><slot></slot></div>`,
    };

    const app = createApp({
      components: { Child },
      render() {
        return h(Child, null, {
          default: () => ["slot content"],
        });
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>slot content</div>");
  });
});
