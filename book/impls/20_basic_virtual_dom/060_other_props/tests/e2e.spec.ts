import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, h, reactive } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("20_basic_virtual_dom/060_other_props", () => {
  it("should handle class and style props", async () => {
    const state = reactive({ active: false });
    const app = createApp({
      setup() {
        return () =>
          h("div", { class: state.active ? "active" : "", style: { color: "red" } }, ["test"]);
      },
    });
    app.mount("#host");

    const div = host.querySelector("div") as HTMLDivElement;
    expect(div.className).toBe("");
    expect(div.style.color).toBe("red");

    state.active = true;
    await Promise.resolve();
    expect(div.className).toBe("active");
  });
});
