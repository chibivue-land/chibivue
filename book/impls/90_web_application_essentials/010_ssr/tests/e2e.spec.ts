import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, createSSRApp, h, renderToString, ref } from "../packages";

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

describe("90_web_application_essentials/010_ssr - hydration", () => {
  it("should create SSR app", () => {
    const app = createSSRApp({
      template: `<div>Hello SSR App!</div>`,
    });

    expect(app).toBeDefined();
    expect(app.mount).toBeDefined();
  });

  it("should hydrate SSR rendered content", async () => {
    // First, render on server
    const serverApp = createApp({
      template: `<div>Hydrated content</div>`,
    });
    const html = await renderToString(serverApp);

    // Set up host with SSR content
    host.innerHTML = html;

    // Then hydrate on client
    const clientApp = createSSRApp({
      template: `<div>Hydrated content</div>`,
    });
    clientApp.mount("#host");

    // Content should still be there
    expect(host.innerHTML).toContain("Hydrated content");
  });

  it("should hydrate content with dynamic data", async () => {
    // Server render
    const serverApp = createApp({
      setup() {
        return { msg: "Hello from SSR" };
      },
      template: `<div>{{ msg }}</div>`,
    });
    const html = await renderToString(serverApp);
    host.innerHTML = html;

    // Client hydrate
    const clientApp = createSSRApp({
      setup() {
        return { msg: "Hello from SSR" };
      },
      template: `<div>{{ msg }}</div>`,
    });
    clientApp.mount("#host");

    expect(host.innerHTML).toContain("Hello from SSR");
  });

  it("should hydrate nested elements", async () => {
    const serverApp = createApp({
      template: `<div><span>nested</span><p>content</p></div>`,
    });
    const html = await renderToString(serverApp);
    host.innerHTML = html;

    const clientApp = createSSRApp({
      template: `<div><span>nested</span><p>content</p></div>`,
    });
    clientApp.mount("#host");

    expect(host.innerHTML).toContain("<span>nested</span>");
    expect(host.innerHTML).toContain("<p>content</p>");
  });
});
