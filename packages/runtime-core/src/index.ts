// Core API ------------------------------------------------------------------

export {
  // core
  reactive,
  ref,
  // utilities
  unref,
  proxyRefs,
  isRef,
  // effect
  ReactiveEffect,
  // effect scope
  EffectScope,
  effect,
} from "@chibivue/reactivity";
export type { Ref, ReactiveFlags, ComputedRef } from "@chibivue/reactivity";

export { computed } from "./apiComputed";
export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
} from "./apiLifecycle";
export { provide, inject, type InjectionKey } from "./apiInject";

export { h } from "./h";

export { resolveComponent } from "./helpers/resolveAssets";
export { renderList } from "./helpers/renderList";

export {
  type VNode,
  type VNodeProps as VNodeData,
  createVNode,
  createTextVNode,
  createCommentVNode,
  createElementVNode,
  mergeProps,
  Fragment,
} from "./vnode";

export { type RendererOptions, type RootRenderFunction, createRenderer } from "./renderer";
export type { DirectiveBinding, DirectiveHook, ObjectDirective } from "./directives";

export { withDirectives } from "./directives";

export type { CreateAppFunction, App, AppContext } from "./apiCreateApp";
export { createAppContext } from "./apiCreateApp";
export { defineComponent } from "./apiDefineComponent";

export {
  type ComponentInternalInstance,
  type Data,
  type LifecycleHook,
  registerRuntimeCompiler,
  getCurrentInstance,
  setCurrentInstance,
  unsetCurrentInstance,
} from "./component";
export { LifecycleHooks } from "./enums";
export { type ComponentOptions, type RenderFunction } from "./componentOptions";
export { type ComponentPublicInstance } from "./componentPublicInstance";

export {
  capitalize,
  toHandlerKey,
  toDisplayString,
  normalizeClass,
  normalizeStyle,
  normalizeProps,
} from "@chibivue/shared";

export { toHandlers } from "./helpers/toHandlers";
