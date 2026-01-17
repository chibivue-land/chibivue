import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  describe("class", () => {
    it("should handle class prop", async () => {
      const state = reactive({ active: false });
      const app = createApp({
        setup() {
          return () => h("div", { class: state.active ? "active" : "" }, ["test"]);
        },
      });
      app.mount("#host");

      const div = host.querySelector("div") as HTMLDivElement;
      expect(div.className).toBe("");

      state.active = true;
      await Promise.resolve();
      expect(div.className).toBe("active");
    });

    it("should remove class when set to null", async () => {
      const state = reactive<{ cls: string | null }>({ cls: "foo" });
      const app = createApp({
        setup() {
          return () => h("div", { class: state.cls }, ["test"]);
        },
      });
      app.mount("#host");

      const div = host.querySelector("div") as HTMLDivElement;
      expect(div.className).toBe("foo");

      state.cls = null;
      await Promise.resolve();
      expect(div.hasAttribute("class")).toBe(false);
    });
  });

  describe("style", () => {
    it("should handle style object", () => {
      const app = createApp({
        setup() {
          return () => h("div", { style: { color: "red", fontSize: "14px" } }, ["test"]);
        },
      });
      app.mount("#host");

      const div = host.querySelector("div") as HTMLDivElement;
      expect(div.style.color).toBe("red");
      expect(div.style.fontSize).toBe("14px");
    });

    it("should handle style string", () => {
      const app = createApp({
        setup() {
          return () => h("div", { style: "color: blue; font-size: 16px" }, ["test"]);
        },
      });
      app.mount("#host");

      const div = host.querySelector("div") as HTMLDivElement;
      expect(div.style.color).toBe("blue");
      expect(div.style.fontSize).toBe("16px");
    });

    it("should update style", async () => {
      const state = reactive({ color: "red" });
      const app = createApp({
        setup() {
          return () => h("div", { style: { color: state.color } }, ["test"]);
        },
      });
      app.mount("#host");

      const div = host.querySelector("div") as HTMLDivElement;
      expect(div.style.color).toBe("red");

      state.color = "blue";
      await Promise.resolve();
      expect(div.style.color).toBe("blue");
    });

    it("should remove old style properties", async () => {
      const state = reactive<{ style: Record<string, string> }>({
        style: { color: "red", fontSize: "14px" },
      });
      const app = createApp({
        setup() {
          return () => h("div", { style: state.style }, ["test"]);
        },
      });
      app.mount("#host");

      const div = host.querySelector("div") as HTMLDivElement;
      expect(div.style.color).toBe("red");
      expect(div.style.fontSize).toBe("14px");

      state.style = { color: "blue" };
      await Promise.resolve();
      expect(div.style.color).toBe("blue");
      expect(div.style.fontSize).toBe("");
    });

    it("should handle CSS custom properties", () => {
      const app = createApp({
        setup() {
          return () => h("div", { style: { "--custom-color": "red" } }, ["test"]);
        },
      });
      app.mount("#host");

      const div = host.querySelector("div") as HTMLDivElement;
      expect(div.style.getPropertyValue("--custom-color")).toBe("red");
    });

    it("should remove style when set to null", async () => {
      const state = reactive<{ style: Record<string, string> | null }>({
        style: { color: "red" },
      });
      const app = createApp({
        setup() {
          return () => h("div", { style: state.style }, ["test"]);
        },
      });
      app.mount("#host");

      const div = host.querySelector("div") as HTMLDivElement;
      expect(div.style.color).toBe("red");

      state.style = null;
      await Promise.resolve();
      expect(div.style.color).toBe("");
    });
  });

  describe("attrs", () => {
    it("should set attributes", () => {
      const app = createApp({
        setup() {
          return () => h("div", { "data-id": "123", "aria-label": "test" }, ["test"]);
        },
      });
      app.mount("#host");

      const div = host.querySelector("div") as HTMLDivElement;
      expect(div.getAttribute("data-id")).toBe("123");
      expect(div.getAttribute("aria-label")).toBe("test");
    });

    it("should update attributes", async () => {
      const state = reactive({ id: "foo" });
      const app = createApp({
        setup() {
          return () => h("div", { "data-id": state.id }, ["test"]);
        },
      });
      app.mount("#host");

      const div = host.querySelector("div") as HTMLDivElement;
      expect(div.getAttribute("data-id")).toBe("foo");

      state.id = "bar";
      await Promise.resolve();
      expect(div.getAttribute("data-id")).toBe("bar");
    });

    it("should remove attributes when set to null", async () => {
      const state = reactive<{ id: string | null }>({ id: "foo" });
      const app = createApp({
        setup() {
          return () => h("div", { "data-id": state.id }, ["test"]);
        },
      });
      app.mount("#host");

      const div = host.querySelector("div") as HTMLDivElement;
      expect(div.getAttribute("data-id")).toBe("foo");

      state.id = null;
      await Promise.resolve();
      expect(div.hasAttribute("data-id")).toBe(false);
    });

    it("should treat spellcheck as attribute", () => {
      const app = createApp({
        setup() {
          return () => h("input", { spellcheck: "false" }, []);
        },
      });
      app.mount("#host");

      const input = host.querySelector("input") as HTMLInputElement;
      expect(input.getAttribute("spellcheck")).toBe("false");
    });

    it("should treat draggable as attribute", () => {
      const app = createApp({
        setup() {
          return () => h("div", { draggable: "true" }, ["test"]);
        },
      });
      app.mount("#host");

      const div = host.querySelector("div") as HTMLDivElement;
      expect(div.getAttribute("draggable")).toBe("true");
    });
  });

  describe("DOM props", () => {
    it("should set innerHTML", () => {
      const app = createApp({
        setup() {
          return () => h("div", { innerHTML: "<span>hello</span>" }, []);
        },
      });
      app.mount("#host");

      const div = host.querySelector("div") as HTMLDivElement;
      expect(div.innerHTML).toBe("<span>hello</span>");
    });

    it("should set textContent", () => {
      const app = createApp({
        setup() {
          return () => h("div", { textContent: "hello world" }, []);
        },
      });
      app.mount("#host");

      const div = host.querySelector("div") as HTMLDivElement;
      expect(div.textContent).toBe("hello world");
    });

    it("should set value on input", async () => {
      const state = reactive({ value: "initial" });
      const app = createApp({
        setup() {
          return () => h("input", { value: state.value }, []);
        },
      });
      app.mount("#host");

      const input = host.querySelector("input") as HTMLInputElement;
      expect(input.value).toBe("initial");

      state.value = "updated";
      await Promise.resolve();
      expect(input.value).toBe("updated");
    });

    it("should set checked on checkbox", async () => {
      const state = reactive({ checked: false });
      const app = createApp({
        setup() {
          return () => h("input", { type: "checkbox", checked: state.checked }, []);
        },
      });
      app.mount("#host");

      const input = host.querySelector("input") as HTMLInputElement;
      expect(input.checked).toBe(false);

      state.checked = true;
      await Promise.resolve();
      expect(input.checked).toBe(true);
    });

    it("should handle boolean attributes correctly", () => {
      const app = createApp({
        setup() {
          return () => h("select", { multiple: "" }, []);
        },
      });
      app.mount("#host");

      const select = host.querySelector("select") as HTMLSelectElement;
      expect(select.multiple).toBe(true);
    });
  });

  describe("events", () => {
    it("should handle click event", async () => {
      const onClick = vi.fn();
      const app = createApp({
        setup() {
          return () => h("button", { onClick }, ["click me"]);
        },
      });
      app.mount("#host");

      const button = host.querySelector("button") as HTMLButtonElement;
      button.click();
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("should update event handler", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const state = reactive({ handler: handler1 });
      const app = createApp({
        setup() {
          return () => h("button", { onClick: state.handler }, ["click me"]);
        },
      });
      app.mount("#host");

      const button = host.querySelector("button") as HTMLButtonElement;
      button.click();
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(0);

      state.handler = handler2;
      await Promise.resolve();
      button.click();
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should remove event handler when set to null", async () => {
      const onClick = vi.fn();
      const state = reactive<{ handler: (() => void) | null }>({ handler: onClick });
      const app = createApp({
        setup() {
          return () => h("button", { onClick: state.handler }, ["click me"]);
        },
      });
      app.mount("#host");

      const button = host.querySelector("button") as HTMLButtonElement;
      button.click();
      expect(onClick).toHaveBeenCalledTimes(1);

      state.handler = null;
      await Promise.resolve();
      button.click();
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("should pass event object to handler", () => {
      let receivedEvent: Event | null = null;
      const app = createApp({
        setup() {
          return () =>
            h(
              "button",
              {
                onClick: (e: Event) => {
                  receivedEvent = e;
                },
              },
              ["click me"],
            );
        },
      });
      app.mount("#host");

      const button = host.querySelector("button") as HTMLButtonElement;
      button.click();
      expect(receivedEvent).toBeInstanceOf(Event);
    });
  });
});
