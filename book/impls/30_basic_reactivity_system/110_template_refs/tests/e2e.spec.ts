import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, h, ref } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("30_basic_reactivity_system/110_template_refs", () => {
  it("should set template ref", async () => {
    const divRef = ref<HTMLDivElement | null>(null);
    const app = createApp({
      setup() {
        return () => h("div", { ref: divRef }, ["test"]);
      },
    });
    app.mount("#host");

    expect(divRef.value).toBeInstanceOf(HTMLDivElement);
    expect(divRef.value?.textContent).toBe("test");
  });
});
