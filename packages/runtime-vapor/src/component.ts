import type { AppContext, VNode } from '@chibivue/runtime-core'
import { createAppContext } from '@chibivue/runtime-core'

import type {
  ComponentInternalInstance,
  Data,
  LifecycleHook,
} from '@chibivue/runtime-core'
import {
  LifecycleHooks,
  setCurrentInstance,
  unsetCurrentInstance,
} from '@chibivue/runtime-core'

import { type VaporNode } from '.'

export type VaporComponent = (self: VaporComponentInternalInstance) => VaporNode

export interface VaporComponentInternalInstance {
  __is_vapor: true
  uid: number
  type: VaporComponent
  parent: ComponentInternalInstance | VaporComponentInternalInstance | null
  appContext: AppContext

  provides: Data

  isMounted: boolean
  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook
  [LifecycleHooks.MOUNTED]: LifecycleHook
  [LifecycleHooks.BEFORE_UPDATE]: LifecycleHook
  [LifecycleHooks.UPDATED]: LifecycleHook
  [LifecycleHooks.BEFORE_UNMOUNT]: LifecycleHook
  [LifecycleHooks.UNMOUNTED]: LifecycleHook
}

let uid = 0
export const createVaporComponentInstance = (
  vnode: VNode,
  parent?: ComponentInternalInstance | VaporComponentInternalInstance | null,
): VaporComponentInternalInstance => {
  const appContext =
    (parent ? parent.appContext : vnode.appContext) || createAppContext()

  const instance: VaporComponentInternalInstance = {
    __is_vapor: true,
    uid: uid++,
    type: vnode.type as VaporComponent,
    parent: parent ?? null,
    appContext,

    provides: parent ? parent.provides : Object.create(appContext.provides),

    isMounted: false,
    [LifecycleHooks.BEFORE_MOUNT]: null,
    [LifecycleHooks.MOUNTED]: null,
    [LifecycleHooks.BEFORE_UPDATE]: null,
    [LifecycleHooks.UPDATED]: null,
    [LifecycleHooks.BEFORE_UNMOUNT]: null,
    [LifecycleHooks.UNMOUNTED]: null,
  }
  return instance
}

export const initialRenderVaporComponent = (
  instance: VaporComponentInternalInstance,
): VaporNode => {
  setCurrentInstance(instance as any) //TODO: types
  const el = instance.type(instance)
  unsetCurrentInstance()
  return el
}

export const isVapor = (
  instance: ComponentInternalInstance | VaporComponentInternalInstance,
): instance is VaporComponentInternalInstance => {
  return (instance as any).__is_vapor
}
