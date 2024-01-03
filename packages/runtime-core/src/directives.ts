import { isFunction } from '@chibivue/shared'
import { ComponentInternalInstance } from './component'
import { ComponentPublicInstance } from './componentPublicInstance'
import { currentRenderingInstance } from './componentRenderContext'
import { VNode } from './vnode'

export interface DirectiveBinding<V = any> {
  instance: ComponentPublicInstance | null
  value: V
  oldValue: V | null
  arg?: string
  dir: ObjectDirective<any>
}

export type DirectiveHook<T = any> = (
  el: T,
  binding: DirectiveBinding,
  vnode: VNode,
  prevVNode: VNode | null,
) => void

export interface ObjectDirective<T = any> {
  created?: DirectiveHook<T>
  beforeMount?: DirectiveHook<T>
  mounted?: DirectiveHook<T>
  beforeUpdate?: DirectiveHook<T>
  updated?: DirectiveHook<T>
  beforeUnmount?: DirectiveHook<T>
  unmounted?: DirectiveHook<T>
  deep?: boolean
}

export type DirectiveArguments = Array<
  | [ObjectDirective | undefined]
  | [ObjectDirective | undefined, any]
  | [ObjectDirective | undefined, any, string]
>

export function withDirectives<T extends VNode>(
  vnode: T,
  directives: DirectiveArguments,
): T {
  const internalInstance = currentRenderingInstance
  if (internalInstance === null) return vnode

  const instance = internalInstance.proxy

  const bindings: DirectiveBinding[] = vnode.dirs || (vnode.dirs = [])
  for (let i = 0; i < directives.length; i++) {
    let [dir, value, arg] = directives[i]
    if (dir) {
      if (isFunction(dir)) {
        dir = {
          mounted: dir,
          updated: dir,
        } as ObjectDirective
      }
      bindings.push({
        dir,
        instance,
        value,
        oldValue: void 0,
        arg,
      })
    }
  }
  return vnode
}

export function invokeDirectiveHook(
  vnode: VNode,
  prevVNode: VNode | null,
  name: keyof ObjectDirective,
) {
  const bindings = vnode.dirs!
  const oldBindings = prevVNode && prevVNode.dirs!
  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i]
    if (oldBindings) {
      binding.oldValue = oldBindings[i].value
    }

    const hook = binding.dir[name] as DirectiveHook | undefined
    if (hook) {
      hook(vnode.el, binding, vnode, prevVNode)
    }
  }
}
