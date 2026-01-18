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

describe("40_basic_component_system/050_component_slot", () => {
  it("should render slot content", () => {
    const Child = {
      setup(_: any, { slots }: { slots: any }) {
        return () => h("div", {}, [slots.default ? slots.default() : "no slot"]);
      },
    };

    const app = createApp({
      setup() {
        // At this stage, slot is passed as a function (default slot only)
        return () => h(Child, {}, () => h("span", {}, ["slot content"]));
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div><span>slot content</span></div>");
  });
});
