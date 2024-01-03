export const FRAGMENT = Symbol()
export const CREATE_VNODE = Symbol()
export const CREATE_COMMENT = Symbol()
export const RENDER_LIST = Symbol()
export const MERGE_PROPS = Symbol()
export const NORMALIZE_CLASS = Symbol()
export const NORMALIZE_STYLE = Symbol()
export const NORMALIZE_PROPS = Symbol()
export const TO_HANDLERS = Symbol()
export const TO_HANDLER_KEY = Symbol()

export const helperNameMap: Record<symbol, string> = {
  [FRAGMENT]: 'Fragment',
  [CREATE_VNODE]: 'createVNode',
  [CREATE_COMMENT]: 'createCommentVNode',
  [RENDER_LIST]: `renderList`,
  [MERGE_PROPS]: 'mergeProps',
  [NORMALIZE_CLASS]: 'normalizeClass',
  [NORMALIZE_STYLE]: 'normalizeStyle',
  [NORMALIZE_PROPS]: 'normalizeProps',
  [TO_HANDLERS]: 'toHandlers',
  [TO_HANDLER_KEY]: 'toHandlerKey',
}

export function registerRuntimeHelpers(helpers: Record<symbol, string>) {
  Object.getOwnPropertySymbols(helpers).forEach(s => {
    helperNameMap[s] = helpers[s]
  })
}
