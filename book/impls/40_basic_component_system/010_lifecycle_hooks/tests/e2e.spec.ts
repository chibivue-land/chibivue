import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp, h, onMounted, onUpdated, ref } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("40_basic_component_system/010_lifecycle_hooks", () => {
  it("should call onMounted hook", () => {
    const mounted = vi.fn();

    const app = createApp({
      setup() {
        onMounted(mounted);
        return () => h("div", {}, ["test"]);
      },
    });
    app.mount("#host");

    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it("should call onUpdated hook", async () => {
    const updated = vi.fn();
    const count = ref(0);

    const app = createApp({
      setup() {
        onUpdated(updated);
        return () => h("div", {}, [`count: ${count.value}`]);
      },
    });
    app.mount("#host");

    expect(updated).not.toHaveBeenCalled();

    count.value = 1;
    await Promise.resolve();
    expect(updated).toHaveBeenCalledTimes(1);
  });
});
