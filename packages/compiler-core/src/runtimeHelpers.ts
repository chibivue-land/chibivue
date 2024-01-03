export const FRAGMENT = Symbol()
export const CREATE_VNODE = Symbol()
export const CREATE_ELEMENT_VNODE = Symbol()
export const CREATE_COMMENT = Symbol()
export const RESOLVE_COMPONENT = Symbol(``)
export const WITH_DIRECTIVES = Symbol()
export const RENDER_LIST = Symbol()
export const TO_DISPLAY_STRING = Symbol()
export const MERGE_PROPS = Symbol()
export const NORMALIZE_CLASS = Symbol()
export const NORMALIZE_STYLE = Symbol()
export const NORMALIZE_PROPS = Symbol()

export const TO_HANDLERS = Symbol()
export const TO_HANDLER_KEY = Symbol()
export const UNREF = Symbol()

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
  [TO_HANDLERS]: 'toHandlers',
  [TO_HANDLER_KEY]: `toHandlerKey`,
  [WITH_DIRECTIVES]: `withDirectives`,
  [RENDER_LIST]: `renderList`,
  [UNREF]: `unref`,
}

export function registerRuntimeHelpers(helpers: Record<symbol, string>) {
  Object.getOwnPropertySymbols(helpers).forEach(s => {
    helperNameMap[s] = helpers[s]
  })
}
