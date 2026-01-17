import { describe, expect, it, vi } from "vitest";

import { EffectScope, ReactiveEffect, ref } from "../packages";

describe("30_basic_reactivity_system/140_effect_scope", () => {
  it("should run function in scope", () => {
    const scope = new EffectScope();
    const result = scope.run(() => {
      return 42;
    });

    expect(result).toBe(42);
  });

  it("should stop effects in scope", () => {
    const count = ref(0);
    const callback = vi.fn();

    const scope = new EffectScope();
    scope.run(() => {
      const effect = new ReactiveEffect(() => {
        callback(count.value);
      }, null, scope);
      effect.run();
    });

    expect(callback).toHaveBeenCalledWith(0);
    expect(scope.effects.length).toBe(1);

    scope.stop();
    expect(scope.active).toBe(false);
  });
});
