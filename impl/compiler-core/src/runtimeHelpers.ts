export const FRAGMENT: unique symbol = Symbol();
export const CREATE_VNODE: unique symbol = Symbol();
export const CREATE_ELEMENT_VNODE: unique symbol = Symbol();
export const CREATE_COMMENT: unique symbol = Symbol();
export const RESOLVE_COMPONENT: unique symbol = Symbol(``);
export const WITH_DIRECTIVES: unique symbol = Symbol();
export const RENDER_LIST: unique symbol = Symbol();
export const TO_DISPLAY_STRING: unique symbol = Symbol();
export const MERGE_PROPS: unique symbol = Symbol();
export const NORMALIZE_CLASS: unique symbol = Symbol();
export const NORMALIZE_STYLE: unique symbol = Symbol();
export const NORMALIZE_PROPS: unique symbol = Symbol();

export const TO_HANDLERS: unique symbol = Symbol();
export const TO_HANDLER_KEY: unique symbol = Symbol();
export const UNREF: unique symbol = Symbol();

export const helperNameMap: Record<symbol, string> = {
  [FRAGMENT]: `Fragment`,
  [CREATE_VNODE]: `createVNode`,
  [CREATE_ELEMENT_VNODE]: `createElementVNode`,
  [CREATE_COMMENT]: `createCommentVNode`,
  [RESOLVE_COMPONENT]: `resolveComponent`,
  [TO_DISPLAY_STRING]: `toDisplayString`,
  [MERGE_PROPS]: `mergeProps`,
  [NORMALIZE_CLASS]: `normalizeClass`,
  [NORMALIZE_STYLE]: `normalizeStyle`,
  [NORMALIZE_PROPS]: `normalizeProps`,
  [TO_HANDLERS]: "toHandlers",
  [TO_HANDLER_KEY]: `toHandlerKey`,
  [WITH_DIRECTIVES]: `withDirectives`,
  [RENDER_LIST]: `renderList`,
  [UNREF]: `unref`,
};

export function registerRuntimeHelpers(helpers: Record<symbol, string>): void {
  Object.getOwnPropertySymbols(helpers).forEach((s) => {
    helperNameMap[s] = helpers[s];
  });
}
