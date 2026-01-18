import { describe, expect, it } from "vitest";

import { customRef, isRef, ref, unref } from "../packages";

describe("30_basic_reactivity_system/150_other_apis", () => {
  it("isRef should identify refs", () => {
    const r = ref(0);
    expect(isRef(r)).toBe(true);
    expect(isRef(0)).toBe(false);
  });

  it("unref should unwrap refs", () => {
    const r = ref(5);
    expect(unref(r)).toBe(5);
    expect(unref(5)).toBe(5);
  });

  it("customRef should work", () => {
    const r = customRef((track, trigger) => ({
      get: () => {
        track();
        return 42;
      },
      set: () => {
        trigger();
      },
    }));
    expect(r.value).toBe(42);
  });
});
