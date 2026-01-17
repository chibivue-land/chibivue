import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, ref } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("50_basic_template_compiler/040_v_if_and_structural_directive", () => {
  it("should render conditionally with v-if", async () => {
    const show = ref(true);
    const app = createApp({
      setup() {
        return { show };
      },
      template: `<div v-if="show">visible</div>`,
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>visible</div>");

    show.value = false;
    await Promise.resolve();
    expect(host.innerHTML).toBe("<!---->");
  });
});
