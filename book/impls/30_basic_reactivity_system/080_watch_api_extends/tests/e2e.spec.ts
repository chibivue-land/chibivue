import { describe, expect, it, vi } from "vitest";

import { reactive, watch } from "../packages";

describe("30_basic_reactivity_system/080_watch_api_extends", () => {
  it("should watch reactive object with deep option", async () => {
    const state = reactive({ nested: { count: 0 } });
    const callback = vi.fn();

    watch(state, callback, { deep: true });

    state.nested.count = 1;
    await Promise.resolve();
    expect(callback).toHaveBeenCalled();
  });

  it("should call immediately with immediate option", async () => {
    const state = reactive({ count: 0 });
    const callback = vi.fn();

    watch(() => state.count, callback, { immediate: true });

    // At this stage, onCleanup is not passed to callback
    expect(callback).toHaveBeenCalledWith(0, undefined);
  });
});
