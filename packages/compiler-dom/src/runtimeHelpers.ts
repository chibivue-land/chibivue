import { registerRuntimeHelpers } from "@chibivue/compiler-core";

export const V_MODEL_TEXT: unique symbol = Symbol();
export const V_MODEL_DYNAMIC: unique symbol = Symbol();

registerRuntimeHelpers({
  [V_MODEL_TEXT]: `vModelText`,
  [V_MODEL_DYNAMIC]: `vModelDynamic`,
});
