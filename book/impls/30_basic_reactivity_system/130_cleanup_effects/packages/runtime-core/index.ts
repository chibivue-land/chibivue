export type { App, CreateAppFunction } from './apiCreateApp'
export { createAppAPI } from './apiCreateApp'

export {
  registerRuntimeCompiler,
  type InternalRenderFunction,
} from './component'

export type { RendererOptions } from './renderer'
export { createRenderer } from './renderer'
export { h } from './h'

export { nextTick } from './scheduler'

export { watch, watchEffect } from './apiWatch'
