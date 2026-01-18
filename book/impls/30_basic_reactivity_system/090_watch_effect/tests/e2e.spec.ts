import { describe, expect, it, vi } from "vitest";

import { ref, watchEffect } from "../packages";

describe("30_basic_reactivity_system/090_watch_effect", () => {
  it("should run effect immediately and on changes", async () => {
    const count = ref(0);
    const callback = vi.fn();

    watchEffect(() => {
      callback(count.value);
    });

    // Should run immediately
    expect(callback).toHaveBeenCalledWith(0);

    count.value = 1;
    await Promise.resolve();
    expect(callback).toHaveBeenCalledWith(1);
  });
});
