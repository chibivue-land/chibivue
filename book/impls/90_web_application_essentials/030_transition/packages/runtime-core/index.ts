export {
  camelize,
  capitalize,
  toHandlerKey,
  normalizeProps,
  normalizeClass,
  normalizeStyle,
} from "../shared";

export type { App, CreateAppFunction } from "./apiCreateApp";
export { createAppAPI } from "./apiCreateApp";

export { defineComponent } from "./apiDefineComponent";

export {
  registerRuntimeCompiler,
  createComponentInstance,
  setupComponent,
  setCurrentInstance,
  unsetCurrentInstance,
  getCurrentInstance,
  type InternalRenderFunction,
  type ComponentInternalInstance,
  type Component,
} from "./component";

export { KeepAlive } from "./components/KeepAlive";
export { type ComponentOptions } from "./componentOptions";

export { type PropType } from "./componentProps";

export type { RendererOptions } from "./renderer";
export { createRenderer } from "./renderer";
export { h } from "./h";

export { nextTick } from "./scheduler";

export {
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  onUnmounted,
  onUpdated,
  onActivated,
  onDeactivated,
} from "./apiLifecycle";

export { watch, watchEffect } from "./apiWatch";

export { provide, inject, type InjectionKey } from "./apiInject";

export {
  createVNode,
  createCommentVNode,
  normalizeVNode,
  mergeProps,
  isVNode,
  Fragment,
  Text,
  Comment,
  type VNode,
  type VNodeProps,
  type VNodeArrayChildren,
  type DirectiveBinding,
} from "./vnode";

export { toHandlers } from "./helpers/toHandlers";
export { renderList } from "./helpers/renderList";
export { renderSlot } from "./helpers/renderSlot";
export { resolveComponent } from "./helpers/resolveAssets";
