import { describe, expect, it, vi } from "vitest";

import { ref, watch } from "../packages";

describe("30_basic_reactivity_system/070_watch", () => {
  it("should watch getter function", async () => {
    const count = ref(0);
    const callback = vi.fn();

    // At this stage, watch only accepts getter function
    watch(() => count.value, callback);

    count.value = 1;
    await Promise.resolve();
    expect(callback).toHaveBeenCalledWith(1, 0);

    count.value = 2;
    await Promise.resolve();
    expect(callback).toHaveBeenCalledWith(2, 1);
  });
});
