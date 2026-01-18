import { registerRuntimeHelpers } from "@chibivue/compiler-core";

export const V_MODEL_TEXT: unique symbol = Symbol();
export const V_MODEL_DYNAMIC: unique symbol = Symbol();
export const V_SHOW: unique symbol = Symbol();

registerRuntimeHelpers({
  [V_MODEL_TEXT]: `vModelText`,
  [V_MODEL_DYNAMIC]: `vModelDynamic`,
  [V_SHOW]: `vShow`,
});
