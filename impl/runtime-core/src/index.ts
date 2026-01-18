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
  onActivated,
  onDeactivated,
} from "./apiLifecycle";
export { provide, inject, type InjectionKey } from "./apiInject";

export { h } from "./h";

export { resolveComponent } from "./helpers/resolveAssets";
export { renderList } from "./helpers/renderList";

export {
  type VNode,
  type VNodeProps as VNodeData,
  type VNodeArrayChildren,
  createVNode,
  createTextVNode,
  createCommentVNode,
  createElementVNode,
  mergeProps,
  normalizeVNode,
  isVNode,
  Fragment,
  Text,
  Comment,
} from "./vnode";

export { Teleport, type TeleportProps } from "./components/Teleport";
export { KeepAlive, type KeepAliveProps } from "./components/KeepAlive";

export { type RendererOptions, type RootRenderFunction, createRenderer } from "./renderer";
export type { DirectiveBinding, DirectiveHook, ObjectDirective } from "./directives";

export { withDirectives } from "./directives";

export type { CreateAppFunction, App, AppContext } from "./apiCreateApp";
export { createAppContext } from "./apiCreateApp";
export { defineComponent } from "./apiDefineComponent";
export { defineAsyncComponent, type AsyncComponentOptions, type AsyncComponentLoader } from "./apiAsyncComponent";

export {
  type ComponentInternalInstance,
  type Component,
  type Data,
  type LifecycleHook,
  registerRuntimeCompiler,
  getCurrentInstance,
  setCurrentInstance,
  unsetCurrentInstance,
  createComponentInstance,
  setupComponent,
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
  PatchFlags,
  PatchFlagNames,
} from "@chibivue/shared";

export { toHandlers } from "./helpers/toHandlers";
