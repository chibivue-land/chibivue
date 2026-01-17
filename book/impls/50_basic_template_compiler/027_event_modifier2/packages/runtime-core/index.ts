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

export { registerRuntimeCompiler, type InternalRenderFunction } from "./component";
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
} from "./apiLifecycle";

export { watch, watchEffect } from "./apiWatch";

export { provide, inject, type InjectionKey } from "./apiInject";

export { createVNode } from "./vnode";

export { toHandlers } from "./helpers/toHandlers";
