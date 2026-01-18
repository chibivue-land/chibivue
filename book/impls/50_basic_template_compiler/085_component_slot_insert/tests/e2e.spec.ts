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

describe("50_basic_template_compiler/085_component_slot_insert", () => {
  it("should compile slot insertion with template syntax", () => {
    const Child = {
      template: `<div><slot></slot></div>`,
    };

    const app = createApp({
      components: { Child },
      template: `<Child><template #default>slot content</template></Child>`,
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>slot content</div>");
  });

  it("should compile named slots with template syntax", () => {
    const Child = {
      template: `<header><slot name="header"></slot></header><main><slot></slot></main>`,
    };

    const app = createApp({
      components: { Child },
      template: `<Child><template #header>Header Content</template><template #default>Main Content</template></Child>`,
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<header>Header Content</header><main>Main Content</main>");
  });

  it("should compile implicit default slot", () => {
    const Child = {
      template: `<div><slot></slot></div>`,
    };

    const app = createApp({
      components: { Child },
      template: `<Child>implicit default content</Child>`,
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>implicit default content</div>");
  });

  it("should maintain reactivity in slot content", () => {
    const Child = {
      template: `<div><slot></slot></div>`,
    };

    const count = ref(0);
    const app = createApp({
      components: { Child },
      setup() {
        return { count };
      },
      template: `<Child><template #default>count: {{ count }}</template></Child>`,
    });
    app.mount("#host");

    expect(host.innerHTML).toBe("<div>count: 0</div>");

    count.value++;
    return Promise.resolve().then(() => {
      expect(host.innerHTML).toBe("<div>count: 1</div>");
    });
  });
});
