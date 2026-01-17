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

describe("40_basic_component_system/060_slot_extend", () => {
  it("should render named slots", () => {
    const Child = {
      setup(_: any, { slots }: { slots: any }) {
        return () =>
          h("div", {}, [
            h("header", {}, [slots.header ? slots.header() : null]),
            h("main", {}, [slots.default ? slots.default() : null]),
            h("footer", {}, [slots.footer ? slots.footer() : null]),
          ]);
      },
    };

    const app = createApp({
      setup() {
        return () =>
          h(
            Child,
            {},
            {
              header: () => h("span", {}, ["Header"]),
              default: () => h("span", {}, ["Content"]),
              footer: () => h("span", {}, ["Footer"]),
            },
          );
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe(
      "<div><header><span>Header</span></header><main><span>Content</span></main><footer><span>Footer</span></footer></div>",
    );
  });
});
