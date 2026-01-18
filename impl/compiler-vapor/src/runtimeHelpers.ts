import { registerRuntimeHelpers } from "@chibivue/compiler-core";

export const V_TEMPLATE: unique symbol = Symbol(`template`);
export const V_SET_TEXT: unique symbol = Symbol(`setText`);
export const V_ON: unique symbol = Symbol(`on`);
export const V_CREATE_COMPONENT: unique symbol = Symbol(`createComponent`);

export const vaporHelperNameMap: Record<symbol, string> = {
  [V_TEMPLATE]: "template",
  [V_SET_TEXT]: "setText",
  [V_ON]: "on",
  [V_CREATE_COMPONENT]: "createComponent",
};

registerRuntimeHelpers(vaporHelperNameMap);
