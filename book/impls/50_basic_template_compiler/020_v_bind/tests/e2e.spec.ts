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

describe("50_basic_template_compiler/020_v_bind", () => {
  it("should bind attribute with v-bind", () => {
    const app = createApp({
      setup() {
        const state = reactive({ id: "my-id" });
        return { state };
      },
      template: `<div v-bind:id="state.id">content</div>`,
    });
    app.mount("#host");

    expect(host.innerHTML).toBe('<div id="my-id">content</div>');
  });
});
