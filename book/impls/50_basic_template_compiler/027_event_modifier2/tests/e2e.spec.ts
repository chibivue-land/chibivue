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

describe("50_basic_template_compiler/027_event_modifier2", () => {
  it("should handle event modifiers with shorthand", () => {
    const handler = vi.fn();
    const app = createApp({
      setup() {
        return { handler };
      },
      template: `<button @click.prevent="handler">click</button>`,
    });
    app.mount("#host");

    const btn = host.querySelector("button") as HTMLButtonElement;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    btn.dispatchEvent(event);
    expect(handler).toHaveBeenCalled();
  });
});
