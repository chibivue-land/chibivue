import { registerRuntimeHelpers } from "../compiler-core/runtimeHelpers";

export const V_ON_WITH_MODIFIERS = Symbol();

registerRuntimeHelpers({
  [V_ON_WITH_MODIFIERS]: `withModifiers`,
});
