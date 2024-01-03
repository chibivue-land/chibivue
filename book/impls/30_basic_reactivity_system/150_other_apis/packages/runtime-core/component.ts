import { EffectScope, ReactiveEffect } from '../reactivity'
import { emit } from './componentEmits'
import { ComponentOptions } from './componentOptions'
import { Props, initProps } from './componentProps'
import { VNode, VNodeChild } from './vnode'

export type Component = ComponentOptions

export type Data = Record<string, unknown>

export interface ComponentInternalInstance {
  uid: number
  type: Component

  vnode: VNode
  subTree: VNode
  next: VNode | null
  effect: ReactiveEffect
  render: InternalRenderFunction
  update: () => void

  scope: EffectScope

  propsOptions: Props
  props: Data
  emit: (event: string, ...args: any[]) => void
  setupState: Data

  isMounted: boolean
}

export type InternalRenderFunction = {
  (ctx: Data): VNodeChild
}

let uid = 0
export function createComponentInstance(
  vnode: VNode,
): ComponentInternalInstance {
  const type = vnode.type as Component

  const instance: ComponentInternalInstance = {
    uid: uid++,
    type,

    vnode,
    next: null,
    effect: null!,
    subTree: null!,
    update: null!,
    render: null!,

    scope: new EffectScope(),

    propsOptions: type.props || {},
    props: {},
    emit: null!, // to be set immediately
    setupState: {},

    isMounted: false,
  }

  instance.emit = emit.bind(null, instance)
  return instance
}

export const setupComponent = (instance: ComponentInternalInstance) => {
  const { props } = instance.vnode
  initProps(instance, props)

  const component = instance.type as Component
  if (component.setup) {
    instance.scope.on()
    const setupResult = component.setup(instance.props, {
      emit: instance.emit,
    }) as InternalRenderFunction
    instance.scope.off()

    // setupResultの型によって分岐をする
    if (typeof setupResult === 'function') {
      instance.render = setupResult
    } else if (typeof setupResult === 'object' && setupResult !== null) {
      instance.setupState = setupResult
    } else {
      // do nothing
    }
  }

  if (compile && !component.render) {
    const template = component.template ?? ''
    if (template) {
      instance.render = compile(template)
    }
  }

  const { render } = component
  if (render) {
    instance.render = render as InternalRenderFunction
  }
}

type CompileFunction = (template: string) => InternalRenderFunction
let compile: CompileFunction | undefined

export function registerRuntimeCompiler(_compile: any) {
  compile = _compile
}
