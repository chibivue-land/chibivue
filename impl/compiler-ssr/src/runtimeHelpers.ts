import { registerRuntimeHelpers } from "@chibivue/compiler-dom";

export const SSR_INTERPOLATE: unique symbol = Symbol(`ssrInterpolate`);
export const SSR_RENDER_ATTRS: unique symbol = Symbol(`ssrRenderAttrs`);
export const SSR_RENDER_ATTR: unique symbol = Symbol(`ssrRenderAttr`);
export const SSR_RENDER_CLASS: unique symbol = Symbol(`ssrRenderClass`);
export const SSR_RENDER_STYLE: unique symbol = Symbol(`ssrRenderStyle`);
export const SSR_RENDER_DYNAMIC_ATTR: unique symbol = Symbol(`ssrRenderDynamicAttr`);
export const SSR_RENDER_LIST: unique symbol = Symbol(`ssrRenderList`);
export const SSR_INCLUDE_BOOLEAN_ATTR: unique symbol = Symbol(`ssrIncludeBooleanAttr`);
export const SSR_RENDER_COMPONENT: unique symbol = Symbol(`ssrRenderComponent`);
export const SSR_RENDER_VNODE: unique symbol = Symbol(`ssrRenderVNode`);

export const ssrHelpers: Record<symbol, string> = {
  [SSR_INTERPOLATE]: `ssrInterpolate`,
  [SSR_RENDER_ATTRS]: `ssrRenderAttrs`,
  [SSR_RENDER_ATTR]: `ssrRenderAttr`,
  [SSR_RENDER_CLASS]: `ssrRenderClass`,
  [SSR_RENDER_STYLE]: `ssrRenderStyle`,
  [SSR_RENDER_DYNAMIC_ATTR]: `ssrRenderDynamicAttr`,
  [SSR_RENDER_LIST]: `ssrRenderList`,
  [SSR_INCLUDE_BOOLEAN_ATTR]: `ssrIncludeBooleanAttr`,
  [SSR_RENDER_COMPONENT]: `ssrRenderComponent`,
  [SSR_RENDER_VNODE]: `ssrRenderVNode`,
};

// Note: these are helpers imported from @chibivue/server-renderer
registerRuntimeHelpers(ssrHelpers);
