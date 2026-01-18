import { describe, expect, it, vi } from "vitest";

import { ref, watch } from "../packages";

describe("30_basic_reactivity_system/130_cleanup_effects", () => {
  it("should run cleanup on re-run with watch", async () => {
    const count = ref(0);
    const cleanup = vi.fn();

    watch(count, (_newVal, _oldVal, onCleanup) => {
      onCleanup(cleanup);
    });

    count.value = 1;
    await Promise.resolve();
    // cleanup is set but not called yet

    count.value = 2;
    await Promise.resolve();
    expect(cleanup).toHaveBeenCalledTimes(1);

    count.value = 3;
    await Promise.resolve();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });
});
