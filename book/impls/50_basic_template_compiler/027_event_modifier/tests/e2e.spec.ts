import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("50_basic_template_compiler/027_event_modifier", () => {
  it("should handle event modifiers", () => {
    const handler = vi.fn();
    const app = createApp({
      setup() {
        return { handler };
      },
      template: `<button @click="handler">click</button>`,
    });
    app.mount("#host");

    const btn = host.querySelector("button") as HTMLButtonElement;
    btn.click();
    expect(handler).toHaveBeenCalled();
  });
});
