import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp, h } from "../packages";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("40_basic_component_system/040_setup_context", () => {
  it("should emit events through setup context", async () => {
    const handler = vi.fn();

    const Child = {
      emits: ["update"],
      setup(_: any, { emit }: { emit: (event: string, ...args: any[]) => void }) {
        return () =>
          h(
            "button",
            {
              onClick: () => emit("update", "new value"),
            },
            ["click"],
          );
      },
    };

    const app = createApp({
      setup() {
        return () => h(Child, { onUpdate: handler }, []);
      },
    });
    app.mount("#host");

    const btn = host.querySelector("button") as HTMLButtonElement;
    btn.click();
    expect(handler).toHaveBeenCalledWith("new value");
  });
});
