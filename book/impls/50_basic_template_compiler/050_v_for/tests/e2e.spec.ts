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

describe("50_basic_template_compiler/050_v_for", () => {
  it("should render list with v-for", () => {
    const app = createApp({
      setup() {
        const state = reactive({ items: [1, 2, 3] });
        return { state };
      },
      template: `<ul><li v-for="item in state.items" :key="item">{{ item }}</li></ul>`,
    });
    app.mount("#host");

    expect(host.innerHTML).toBe(
      '<ul><li key="1">1</li><li key="2">2</li><li key="3">3</li></ul>',
    );
  });
});
