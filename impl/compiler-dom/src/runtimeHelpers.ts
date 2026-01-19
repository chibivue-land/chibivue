import { registerRuntimeHelpers } from "@chibivue/compiler-core";

export const V_MODEL_TEXT: unique symbol = Symbol();
export const V_MODEL_DYNAMIC: unique symbol = Symbol();
export const V_SHOW: unique symbol = Symbol();
export const V_ON_WITH_MODIFIERS: unique symbol = Symbol();
export const V_ON_WITH_KEYS: unique symbol = Symbol();

registerRuntimeHelpers({
  [V_MODEL_TEXT]: `vModelText`,
  [V_MODEL_DYNAMIC]: `vModelDynamic`,
  [V_SHOW]: `vShow`,
  [V_ON_WITH_MODIFIERS]: `withModifiers`,
  [V_ON_WITH_KEYS]: `withKeys`,
});
