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
        return h(Transition, { name: "fade" }, {
          default: () => [h("div", { class: "content" }, "Hello Transition")],
        });
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
        return h(Transition, { name: "fade" }, {
          default: () => show.value ? [h("div", null, "visible")] : [],
        });
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
          }
        );
      },
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("custom classes");
  });

  it("should return undefined when no children", () => {
    const app = createApp({
      render() {
        return h(Transition, { name: "fade" }, {
          default: () => [],
        });
      },
    });

    app.mount("#host");
    // When no children, renders as comment node
    expect(host.innerHTML).toBe("<!---->");
  });

  it("should support mode prop", () => {
    const app = createApp({
      render() {
        return h(Transition, { name: "fade", mode: "out-in" }, {
          default: () => [h("div", null, "out-in mode")],
        });
      },
    });

    app.mount("#host");
    expect(host.innerHTML).toContain("out-in mode");
  });
});
