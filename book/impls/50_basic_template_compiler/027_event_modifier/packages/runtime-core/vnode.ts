import { Ref } from '../reactivity'
import { isArray, isFunction, isObject, isString } from '../shared'
import { normalizeClass, normalizeStyle } from '../shared/normalizeProp'
import { ShapeFlags } from '../shared/shapeFlags'
import { AppContext } from './apiCreateApp'
import { ComponentInternalInstance, Data, currentInstance } from './component'
import { RawSlots } from './componentSlots'

export type VNodeTypes = string | typeof Text | object

export const Text = Symbol()

export interface VNode<HostNode = any> {
  type: VNodeTypes
  props: VNodeProps | null
  children: VNodeNormalizedChildren

  el: HostNode | undefined
  key: string | number | symbol | null
  ref: Ref | null

  component: ComponentInternalInstance | null
  shapeFlag: number

  // application root node only
  appContext: AppContext | null
}

export interface VNodeProps {
  [key: string]: any
}

export type VNodeNormalizedChildren = string | VNodeArrayChildren | RawSlots
export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>

export type VNodeChild = VNodeChildAtom | VNodeArrayChildren
type VNodeChildAtom = VNode | string

export function createVNode(
  type: VNodeTypes,
  props: VNodeProps | null,
  children: any,
): VNode {
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isObject(type)
      ? ShapeFlags.COMPONENT
      : 0

  const vnode: VNode = {
    type,
    props,
    children: children,
    el: undefined,
    key: props?.key ?? null,
    ref: props?.ref ?? null,
    component: null,
    shapeFlag,
    appContext: null,
  }

  normalizeChildren(vnode, children)

  return vnode
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

export function normalizeVNode(child: VNodeChild): VNode {
  if (typeof child === 'object') {
    return { ...child } as VNode
  } else {
    return createVNode(Text, null, String(child))
  }
}

export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
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
