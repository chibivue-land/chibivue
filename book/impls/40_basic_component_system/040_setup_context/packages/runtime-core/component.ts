import { EffectScope, type ReactiveEffect } from '../reactivity'
import { proxyRefs } from '../reactivity/ref'
import { type AppContext, createAppContext } from './apiCreateApp'
import { emit } from './componentEmits'
import type { ComponentOptions } from './componentOptions'
import { type Props, initProps } from './componentProps'
import {
  type ComponentPublicInstance,
  PublicInstanceProxyHandlers,
} from './componentPublicInstance'
import { LifecycleHooks } from './enums'
import type { VNode, VNodeChild } from './vnode'

export type Component = ComponentOptions

export type Data = Record<string, unknown>

type LifecycleHook<TFn = Function> = TFn[] | null

export type SetupContext = {
  emit: (e: string, ...args: any[]) => void
  expose: (exposed?: Record<string, any>) => void
}

export interface ComponentInternalInstance {
  uid: number
  type: Component
  parent: ComponentInternalInstance | null
  appContext: AppContext

  vnode: VNode
  subTree: VNode
  next: VNode | null

  effect: ReactiveEffect
  render: InternalRenderFunction
  update: () => void

  provides: Data
  scope: EffectScope

  propsOptions: Props
  props: Data
  emit: (event: string, ...args: any[]) => void
  setupState: Data
  setupContext: SetupContext | null

  proxy: ComponentPublicInstance | null
  exposed: Record<string, any> | null
  exposeProxy: Record<string, any> | null

  ctx: Data

  isMounted: boolean
  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook
  [LifecycleHooks.MOUNTED]: LifecycleHook
  [LifecycleHooks.BEFORE_UPDATE]: LifecycleHook
  [LifecycleHooks.UPDATED]: LifecycleHook
  [LifecycleHooks.BEFORE_UNMOUNT]: LifecycleHook
  [LifecycleHooks.UNMOUNTED]: LifecycleHook
}

export type InternalRenderFunction = {
  (ctx: ComponentPublicInstance): VNodeChild
}

const emptyAppContext = createAppContext()

let uid = 0

export function createComponentInstance(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
): ComponentInternalInstance {
  const type = vnode.type as Component

  const appContext =
    (parent ? parent.appContext : vnode.appContext) || emptyAppContext

  const instance: ComponentInternalInstance = {
    uid: uid++,
    type,
    parent,
    appContext,

    vnode,
    next: null,
    effect: null!,
    subTree: null!,
    update: null!,
    render: null!,

    provides: parent ? parent.provides : Object.create(appContext.provides),
    scope: new EffectScope(),

    propsOptions: type.props || {},
    props: {},
    emit: null!, // to be set immediately
    setupState: {},
    setupContext: null,

    proxy: null,
    exposed: null,
    exposeProxy: null,
    ctx: {},

    isMounted: false,
    [LifecycleHooks.BEFORE_MOUNT]: null,
    [LifecycleHooks.MOUNTED]: null,
    [LifecycleHooks.BEFORE_UPDATE]: null,
    [LifecycleHooks.UPDATED]: null,
    [LifecycleHooks.BEFORE_UNMOUNT]: null,
    [LifecycleHooks.UNMOUNTED]: null,
  }

  instance.emit = emit.bind(null, instance)

  instance.ctx = { _: instance }

  return instance
}

export let currentInstance: ComponentInternalInstance | null = null
export const setCurrentInstance = (instance: ComponentInternalInstance) => {
  currentInstance = instance
  instance.scope.on()
}

export const unsetCurrentInstance = () => {
  currentInstance && currentInstance.scope.off()
  currentInstance = null
}

export const setupComponent = (instance: ComponentInternalInstance) => {
  const { props } = instance.vnode
  initProps(instance, props)

  const { setup, render, template } = instance.type as Component

  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers)

  if (setup) {
    setCurrentInstance(instance)
    const setupContext = (instance.setupContext = createSetupContext(instance))
    const setupResult = setup(
      instance.props,
      setupContext,
    ) as InternalRenderFunction
    unsetCurrentInstance()

    if (typeof setupResult === 'function') {
      instance.render = setupResult
    } else if (typeof setupResult === 'object' && setupResult !== null) {
      instance.setupState = proxyRefs(setupResult)
    } else {
      // do nothing
    }
  }

  if (compile && !render) {
    if (template) {
      instance.render = compile(template)
    }
  }

  if (render) {
    instance.render = render as InternalRenderFunction
  }
}

export function createSetupContext(
  instance: ComponentInternalInstance,
): SetupContext {
  const expose: SetupContext['expose'] = exposed => {
    instance.exposed = exposed || {}
  }
  return {
    emit: instance.emit,
    expose,
  }
}

export function getExposeProxy(instance: ComponentInternalInstance) {
  if (instance.exposed) {
    return (
      instance.exposeProxy ||
      (instance.exposeProxy = new Proxy(proxyRefs(instance.exposed), {
        get(target, key: string) {
          if (key in target) {
            return target[key]
          }
        },
        has(target, key: string) {
          return key in target
        },
      }))
    )
  }
}

type CompileFunction = (template: string) => InternalRenderFunction
let compile: CompileFunction | undefined

export function registerRuntimeCompiler(_compile: any) {
  compile = _compile
}
