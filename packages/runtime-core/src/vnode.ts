import type { Ref } from '@chibivue/reactivity'
import type { VaporComponent } from '@chibivue/runtime-vapor'
import { ShapeFlags } from '@chibivue/shared'

import {
  isArray,
  isFunction,
  isObject,
  isString,
  normalizeClass,
  normalizeStyle,
} from '@chibivue/shared'
import { currentRenderingInstance } from './componentRenderContext'
import { Component, type ComponentInternalInstance, Data } from './component'
import { type ComponentPublicInstance } from './componentPublicInstance'
import { AppContext } from './apiCreateApp'
import { DirectiveBinding } from './directives'
import { RawSlots } from './componentSlots'

export type VNodeTypes =
  | string
  | typeof Text
  | typeof Comment
  | typeof Fragment
  | Component
  | VaporComponent

export const Text = Symbol()
export const Comment = Symbol()
export const Fragment = Symbol() as any as {
  __isFragment: true
  new (): {
    $props: VNodeProps
  }
}

export interface VNode<HostNode = any> {
  __v_isVNode: true
  type: VNodeTypes
  props: VNodeProps | null
  key: string | number | symbol | null
  ref: Ref | null

  // DOM
  el: HostNode | undefined
  anchor: HostNode | null // fragment anchor

  children: VNodeNormalizedChildren
  component: ComponentInternalInstance | null
  dirs: DirectiveBinding[] | null
  ctx: ComponentPublicInstance | null
  shapeFlag: number

  // application root node only
  appContext: AppContext | null
}

export interface VNodeProps {
  [key: string]: any
}

export type VNodeNormalizedChildren = string | VNodeArrayChildren | RawSlots

export type VNodeChild = VNodeChildAtom | VNodeArrayChildren
export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>
type VNodeChildAtom = VNode | string

export function isVNode(value: unknown): value is VNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__v_isVNode' in value &&
    value.__v_isVNode === true
  )
}

export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}

export const createVNode = (
  type: VNodeTypes,
  props: VNodeProps | null = null,
  children: unknown = null,
) => {
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isObject(type)
      ? ShapeFlags.COMPONENT
      : 0

  return createBaseVNode(type, props, children, shapeFlag)
}

function createBaseVNode(
  type: VNodeTypes,
  props: VNodeProps | null,
  children: unknown = null,
  shapeFlag: ShapeFlags | 0 = ShapeFlags.ELEMENT,
): VNode {
  const vnode = {
    __v_isVNode: true,
    type,
    props,
    key: props && props.key,
    ref: props?.ref ?? null,
    children,
    el: null,
    anchor: null,
    ctx: currentRenderingInstance,
    shapeFlag,
    component: null,
    dirs: null,
    appContext: null,
  } as VNode

  normalizeChildren(vnode, children)

  if (children) {
    vnode.shapeFlag |= isString(children)
      ? ShapeFlags.TEXT_CHILDREN
      : ShapeFlags.ARRAY_CHILDREN
  }

  return vnode
}

export { createVNode as createElementVNode }

export function createCommentVNode(text: string = ''): VNode {
  return createVNode(Comment, null, text)
}

export function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0
  const { shapeFlag } = vnode

  if (children == null) {
    children = null
  } else if (isFunction(children)) {
    children = { default: children }
    type = ShapeFlags.SLOTS_CHILDREN
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (typeof children === 'object') {
    if (shapeFlag & ShapeFlags.ELEMENT) {
      return
    } else {
      type = ShapeFlags.SLOTS_CHILDREN
    }
  } else {
    children = String(children)
    type = ShapeFlags.TEXT_CHILDREN
  }
  vnode.children = children as VNodeNormalizedChildren
  vnode.shapeFlag |= type
}

export function createTextVNode(text: string = ' '): VNode {
  return createVNode(Text, null, text)
}

export function normalizeVNode(child: VNodeChild): VNode {
  if (typeof child === 'object') {
    return cloneIfMounted(child as VNode)
  } else {
    return createVNode(Text, null, String(child))
  }
}

export function cloneIfMounted(child: VNode): VNode {
  return child.el === null ? child : cloneVNode(child)
}

export function cloneVNode<T>(vnode: VNode<T>): VNode<T> {
  const { props, children } = vnode
  const cloned: VNode<T> = {
    __v_isVNode: true,
    type: vnode.type,
    props,
    key: vnode.key,
    ref: vnode.ref,
    children: isArray(children)
      ? (children as VNode[]).map(cloneVNode)
      : children,
    component: vnode.component,
    dirs: vnode.dirs,
    shapeFlag: vnode.shapeFlag,
    el: vnode.el,
    anchor: vnode.anchor,
    ctx: vnode.ctx,
    appContext: vnode.appContext,
  }
  return cloned
}

export function mergeProps(...args: (Data & VNodeProps)[]) {
  const ret: Data = {}
  for (let i = 0; i < args.length; i++) {
    const toMerge = args[i]
    for (const key in toMerge) {
      if (key === 'class') {
        if (ret.class !== toMerge.class) {
          ret.class = normalizeClass([ret.class, toMerge.class])
        }
      } else if (key === 'style') {
        ret.style = normalizeStyle([ret.style, toMerge.style])
      } else if (key !== '') {
        ret[key] = toMerge[key]
      } /*if (isOn(key))*/ else {
        // TODO: v-on="object"
      }
    }
  }
  return ret
}
