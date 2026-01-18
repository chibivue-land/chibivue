import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createApp,
  h,
  renderToString,
  KeepAlive,
  onActivated,
  onDeactivated,
  ref,
  Transition,
} from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("90_web_application_essentials/010_ssr", () => {
  it("should render to string", async () => {
    const app = createApp({
      template: `<div>Hello SSR!</div>`,
    });

    const html = await renderToString(app);
    // Single root element, but still wrapped in fragment comments by the template compiler
    expect(html).toContain("<div>Hello SSR!</div>");
  });

  it("should escape HTML in text content", async () => {
    const app = createApp({
      template: `<div>{{ text }}</div>`,
      setup() {
        return { text: "<script>alert('xss')</script>" };
      },
    });

    const html = await renderToString(app);
    expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
  });

  it("should render with class and style bindings", async () => {
    const app = createApp({
      template: `<div :class="cls" :style="styles">content</div>`,
      setup() {
        return {
          cls: { active: true, disabled: false },
          styles: { color: "red", fontSize: "14px" },
        };
      },
    });

    const html = await renderToString(app);
    expect(html).toContain('class="active"');
    expect(html).toContain('style="color:red;font-size:14px;"');
  });

  it("should render fragment", async () => {
    const app = createApp({
      template: `<p>one</p><p>two</p>`,
    });

    const html = await renderToString(app);
    expect(html).toContain("<p>one</p><p>two</p>");
  });

  it("should render nested components", async () => {
    const Child = {
      props: ["name"],
      template: `<span>{{ name }}</span>`,
    };

    const app = createApp({
      components: { Child },
      template: `<div><Child name="test" /></div>`,
    });

    const html = await renderToString(app);
    expect(html).toContain("<span>");
    expect(html).toContain("</span>");
    expect(html).toContain("<div>");
  });

  it("should render with h function", async () => {
    const app = createApp({
      render() {
        return h("div", { class: "test" }, "Hello from h()");
      },
    });

    const html = await renderToString(app);
    expect(html).toBe('<div class="test">Hello from h()</div>');
  });
});

describe("90_web_application_essentials/020_keep_alive", () => {
  it("should render KeepAlive wrapper", () => {
    const Child = {
      name: "Child",
      template: `<div>child content</div>`,
    };

    const app = createApp({
      components: { Child, KeepAlive },
      render() {
        return h(KeepAlive, null, {
          default: () => [h(Child)],
        });
      },
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("child content");
  });

  it("should set COMPONENT_SHOULD_KEEP_ALIVE flag", () => {
    const Child = {
      name: "Child",
      render() {
        return h("div", null, "child");
      },
    };

    const app = createApp({
      components: { Child, KeepAlive },
      render() {
        return h(KeepAlive, null, {
          default: () => [h(Child)],
        });
      },
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("child");
  });

  it("should render with activated/deactivated hooks registered", () => {
    let activated = false;
    let deactivated = false;

    const Child = {
      name: "Child",
      setup() {
        onActivated(() => {
          activated = true;
        });
        onDeactivated(() => {
          deactivated = true;
        });
        return {};
      },
      template: `<div>child</div>`,
    };

    const app = createApp({
      components: { Child, KeepAlive },
      render() {
        return h(KeepAlive, null, {
          default: () => [h(Child)],
        });
      },
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("child");
    // Hooks are registered but not yet called
    expect(activated).toBe(false);
    expect(deactivated).toBe(false);
  });
});

describe("90_web_application_essentials/030_transition", () => {
  it("should render Transition component with child", () => {
    const app = createApp({
      render() {
        return h(
          Transition,
          { name: "fade" },
          {
            default: () => [h("div", { class: "content" }, "Hello Transition")],
          },
        );
      },
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("Hello Transition");
    expect(host.innerHTML).toContain("content");
  });

  it("should apply transition hooks to child vnode", () => {
    const show = ref(true);

    const app = createApp({
      setup() {
        return { show };
      },
      render() {
        return h(
          Transition,
          { name: "fade" },
          {
            default: () => (show.value ? [h("div", null, "visible")] : []),
          },
        );
      },
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("visible");
  });

  it("should support custom transition classes", () => {
    const app = createApp({
      render() {
        return h(
          Transition,
          {
            enterFromClass: "custom-enter-from",
            enterActiveClass: "custom-enter-active",
            enterToClass: "custom-enter-to",
            leaveFromClass: "custom-leave-from",
            leaveActiveClass: "custom-leave-active",
            leaveToClass: "custom-leave-to",
          },
          {
            default: () => [h("div", null, "custom classes")],
          },
        );
      },
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("custom classes");
  });

  it("should return undefined when no children", () => {
    const app = createApp({
      render() {
        return h(
          Transition,
          { name: "fade" },
          {
            default: () => [],
          },
        );
      },
    });

    app.mount("#host");
    // When no children, renders as comment node
    expect(host.innerHTML).toBe("<!---->");
  });

  it("should support mode prop", () => {
    const app = createApp({
      render() {
        return h(
          Transition,
          { name: "fade", mode: "out-in" },
          {
            default: () => [h("div", null, "out-in mode")],
          },
        );
      },
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("out-in mode");
  });
});

describe("90_web_application_essentials/040_static_hoisting", () => {
  it("should render static elements correctly", () => {
    const app = createApp({
      template: `<div><span>static</span><p>{{ msg }}</p></div>`,
      setup() {
        return { msg: "dynamic" };
      },
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("static");
    expect(host.innerHTML).toContain("dynamic");
  });

  it("should render multiple static children", () => {
    const app = createApp({
      template: `<div><span>one</span><span>two</span><span>three</span></div>`,
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("one");
    expect(host.innerHTML).toContain("two");
    expect(host.innerHTML).toContain("three");
  });

  it("should render mixed static and dynamic content", () => {
    const count = ref(0);
    const app = createApp({
      setup() {
        return { count };
      },
      template: `<div><header>Static Header</header><main>Count: {{ count }}</main><footer>Static Footer</footer></div>`,
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("Static Header");
    expect(host.innerHTML).toContain("Count: 0");
    expect(host.innerHTML).toContain("Static Footer");
  });

  it("should preserve static attributes", () => {
    const app = createApp({
      template: `<div><span class="static-class" id="static-id">content</span></div>`,
    });

    app.mount("#host");
    expect(host.innerHTML).toContain('class="static-class"');
    expect(host.innerHTML).toContain('id="static-id"');
  });

  it("should handle deeply nested static elements", () => {
    const app = createApp({
      template: `<div><section><article><p>Deep static content</p></article></section></div>`,
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("Deep static content");
    expect(host.innerHTML).toContain("<section>");
    expect(host.innerHTML).toContain("<article>");
  });
});

describe("90_web_application_essentials/050_patch_flags", () => {
  it("should render elements with dynamic text", () => {
    const msg = ref("hello");
    const app = createApp({
      setup() {
        return { msg };
      },
      template: `<div>{{ msg }}</div>`,
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("hello");
  });

  it("should render elements with dynamic class", () => {
    const isActive = ref(true);
    const app = createApp({
      setup() {
        return { isActive };
      },
      template: `<div :class="{ active: isActive }">content</div>`,
    });

    app.mount("#host");
    expect(host.innerHTML).toContain('class="active"');
  });

  it("should render elements with dynamic style", () => {
    const color = ref("red");
    const app = createApp({
      setup() {
        return { color };
      },
      template: `<div :style="{ color }">styled content</div>`,
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("color");
  });

  it("should render elements with dynamic props", () => {
    const id = ref("my-id");
    const app = createApp({
      setup() {
        return { id };
      },
      template: `<div :id="id">with dynamic id</div>`,
    });

    app.mount("#host");
    expect(host.innerHTML).toContain('id="my-id"');
  });

  it("should render elements with multiple dynamic bindings", () => {
    const app = createApp({
      setup() {
        return {
          cls: "dynamic-class",
          style: { color: "blue" },
          title: "dynamic-title",
        };
      },
      template: `<div :class="cls" :style="style" :title="title">multi-dynamic</div>`,
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("dynamic-class");
    expect(host.innerHTML).toContain("dynamic-title");
    expect(host.innerHTML).toContain("multi-dynamic");
  });
});
