import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, createCommentVNode, h } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("50_basic_template_compiler/035_comment", () => {
  it("should render comments using createCommentVNode", () => {
    const app = createApp({
      render() {
        return h("div", {}, [createCommentVNode(" comment ")]);
      },
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div><!-- comment --></div>");
  });
});
