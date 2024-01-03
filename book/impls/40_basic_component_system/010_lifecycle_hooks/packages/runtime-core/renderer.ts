import { ReactiveEffect } from '../reactivity'
import { invokeArrayFns } from '../shared'
import { ShapeFlags } from '../shared/shapeFlags'
import {
  Component,
  ComponentInternalInstance,
  createComponentInstance,
  setupComponent,
} from './component'
import { updateProps } from './componentProps'
import { setRef } from './rendererTemplateRef'
import {
  SchedulerJob,
  flushPostFlushCbs,
  queueJob,
  queuePostFlushCb,
} from './scheduler'
import {
  Text,
  VNode,
  createVNode,
  isSameVNodeType,
  normalizeVNode,
} from './vnode'

export type RootRenderFunction<HostElement = RendererElement> = (
  vnode: Component,
  container: HostElement,
) => void

export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement,
> {
  patchProp(
    el: HostElement,
    key: string,
    prevValue: any,
    nextValue: any,
    prevChildren?: VNode<HostNode>[],
    unmountChildren?: (children: VNode<HostNode>[]) => void,
  ): void

  createElement(type: string): HostElement

  createText(text: string): HostNode

  setText(node: HostNode, text: string): void

  setElementText(node: HostNode, text: string): void

  insert(child: HostNode, parent: HostNode, anchor?: HostNode | null): void

  remove(child: HostNode): void

  parentNode(node: HostNode): HostNode | null
}

export interface RendererNode {
  [key: string]: any
}

export interface RendererElement extends RendererNode {}

export function createRenderer(options: RendererOptions) {
  const {
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    setText: hostSetText,
    setElementText: hostSetElementText,
    insert: hostInsert,
    remove: hostRemove,
    parentNode: hostParentNode,
  } = options

  const patch = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererElement | null,
  ) => {
    const { type, ref, shapeFlag } = n2
    if (type === Text) {
      processText(n1, n2, container, anchor)
    } else if (shapeFlag & ShapeFlags.ELEMENT) {
      processElement(n1, n2, container, anchor)
    } else if (shapeFlag & ShapeFlags.COMPONENT) {
      processComponent(n1, n2, container, anchor)
    } else {
      // do nothing
    }

    if (ref) {
      setRef(ref, n2)
    }
  }

  const processElement = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererElement | null,
  ) => {
    if (n1 === null) {
      mountElement(n2, container, anchor)
    } else {
      patchElement(n1, n2, anchor)
    }
  }

  const mountElement = (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererElement | null,
  ) => {
    let el: RendererElement
    const { type, props } = vnode
    el = vnode.el = hostCreateElement(type as string)

    mountChildren(vnode.children as VNode[], el, anchor)

    if (props) {
      for (const key in props) {
        hostPatchProp(
          el,
          key,
          null,
          props[key],
          vnode.children as VNode[],
          unmountChildren,
        )
      }
    }

    hostInsert(el, container)
  }

  const mountChildren = (
    children: VNode[],
    container: RendererElement,
    anchor: RendererElement | null,
  ) => {
    for (let i = 0; i < children.length; i++) {
      const child = (children[i] = normalizeVNode(children[i]))
      patch(null, child, container, anchor)
    }
  }

  const patchElement = (
    n1: VNode,
    n2: VNode,
    anchor: RendererElement | null,
  ) => {
    const el = (n2.el = n1.el!)

    const oldProps = n1.props || {}
    const newProps = n2.props || {}

    patchChildren(n1, n2, el, anchor)

    for (const key in oldProps) {
      if (!(key in newProps)) {
        hostPatchProp(el, key, oldProps[key], null)
      }
    }
    for (const key in newProps) {
      const next = newProps[key]
      const prev = oldProps[key]
      if (next !== prev) {
        hostPatchProp(el, key, prev, next)
      }
    }
  }

  const patchChildren = (
    n1: VNode,
    n2: VNode,
    container: RendererElement,
    anchor: RendererElement | null,
  ) => {
    const c1 = n1 && n1.children
    const prevShapeFlag = n1 ? n1.shapeFlag : 0
    const c2 = n2.children
    const { shapeFlag } = n2

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1 as VNode[])
      }
      if (c2 !== c1) {
        hostSetElementText(container, c2 as string)
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          patchKeyedChildren(c1 as VNode[], c2 as VNode[], container, anchor)
        } else {
          unmountChildren(c1 as VNode[])
        }
      } else {
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(container, '')
        }
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(c2 as VNode[], container, anchor)
        }
      }
    }
  }

  const patchKeyedChildren = (
    c1: VNode[],
    c2: VNode[],
    container: RendererElement,
    parentAnchor: RendererElement | null,
  ) => {
    let i = 0
    const l2 = c2.length
    const e1 = c1.length - 1
    const e2 = l2 - 1

    const keyToNewIndexMap: Map<string | number | symbol, number> = new Map()
    for (i = 0; i <= e2; i++) {
      const nextChild = (c2[i] = normalizeVNode(c2[i]))
      if (nextChild.key != null) {
        keyToNewIndexMap.set(nextChild.key, i)
      }
    }

    let j
    let patched = 0
    const toBePatched = e2 + 1
    let moved = false
    let maxNewIndexSoFar = 0

    const newIndexToOldIndexMap = new Array(toBePatched)
    for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0

    for (i = 0; i <= e1; i++) {
      const prevChild = c1[i]
      if (patched >= toBePatched) {
        // all new children have been patched so this can only be a removal
        unmount(prevChild)
        continue
      }
      let newIndex
      if (prevChild.key != null) {
        newIndex = keyToNewIndexMap.get(prevChild.key)
      } else {
        // key-less node, try to locate a key-less node of the same type
        for (j = 0; j <= e2; j++) {
          if (
            newIndexToOldIndexMap[j] === 0 &&
            isSameVNodeType(prevChild, c2[j] as VNode)
          ) {
            newIndex = j
            break
          }
        }
      }
      if (newIndex === undefined) {
        unmount(prevChild)
      } else {
        newIndexToOldIndexMap[newIndex] = i + 1
        if (newIndex >= maxNewIndexSoFar) {
          maxNewIndexSoFar = newIndex
        } else {
          moved = true
        }
        patch(prevChild, c2[newIndex] as VNode, container, null)
        patched++
      }
    }

    const increasingNewIndexSequence = moved
      ? getSequence(newIndexToOldIndexMap)
      : []
    j = increasingNewIndexSequence.length - 1
    for (i = toBePatched - 1; i >= 0; i--) {
      const nextIndex = i
      const nextChild = c2[nextIndex] as VNode
      const anchor =
        nextIndex + 1 < l2 ? (c2[nextIndex + 1] as VNode).el : parentAnchor
      if (newIndexToOldIndexMap[i] === 0) {
        // mount new
        patch(null, nextChild, container, anchor)
      } else if (moved) {
        // move if:
        // There is no stable subsequence (e.g. a reverse)
        // OR current node is not among the stable sequence
        if (j < 0 || i !== increasingNewIndexSequence[j]) {
          move(nextChild, container, anchor)
        } else {
          j--
        }
      }
    }
  }

  const move = (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererElement | null,
  ) => {
    const { el, shapeFlag } = vnode
    if (shapeFlag & ShapeFlags.COMPONENT) {
      move(vnode.component!.subTree, container, anchor)
      return
    }
    hostInsert(el!, container, anchor)
  }

  const unmount = (vnode: VNode) => {
    const { children, shapeFlag } = vnode
    if (shapeFlag & ShapeFlags.COMPONENT) {
      unmountComponent(vnode.component!)
    } else if (Array.isArray(children)) {
      unmountChildren(children as VNode[])
    }
    remove(vnode)
  }

  const remove = (vnode: VNode) => {
    const { el } = vnode
    hostRemove(el!)
  }

  const unmountComponent = (instance: ComponentInternalInstance) => {
    const { subTree, scope, bum, um } = instance

    // beforeUnmount hook
    if (bum) {
      invokeArrayFns(bum)
    }

    scope.stop()
    unmount(subTree)

    // unmounted hook
    if (um) {
      queuePostFlushCb(um)
    }
  }

  const unmountChildren = (children: VNode[]) => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i])
    }
  }

  const processText = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererElement | null,
  ) => {
    if (n1 == null) {
      hostInsert(
        (n2.el = hostCreateText(n2.children as string)),
        container,
        anchor,
      )
    } else {
      const el = (n2.el = n1.el!)
      if (n2.children !== n1.children) {
        hostSetText(el, n2.children as string)
      }
    }
  }

  const processComponent = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererElement | null,
  ) => {
    if (n1 == null) {
      mountComponent(n2, container, anchor)
    } else {
      updateComponent(n1, n2)
    }
  }

  const mountComponent = (
    initialVNode: VNode,
    container: RendererElement,
    anchor: RendererElement | null,
  ) => {
    // prettier-ignore
    const instance: ComponentInternalInstance = (initialVNode.component = createComponentInstance(initialVNode));
    setupComponent(instance)
    setupRenderEffect(instance, initialVNode, container, anchor)
  }

  const setupRenderEffect = (
    instance: ComponentInternalInstance,
    initialVNode: VNode,
    container: RendererElement,
    anchor: RendererElement | null,
  ) => {
    const componentUpdateFn = () => {
      const { render, setupState, bm, m, bu, u } = instance

      if (!instance.isMounted) {
        // beforeMount hook
        if (bm) {
          invokeArrayFns(bm)
        }
        const subTree = (instance.subTree = normalizeVNode(render(setupState)))
        patch(null, subTree, container, anchor)
        initialVNode.el = subTree.el
        instance.isMounted = true
        // mounted hook
        if (m) {
          queuePostFlushCb(m)
        }
      } else {
        let { next, vnode } = instance

        // beforeUpdate hook
        if (bu) {
          invokeArrayFns(bu)
        }

        if (next) {
          next.el = vnode.el
          next.component = instance
          instance.vnode = next
          instance.next = null
          updateProps(instance, next.props)
        } else {
          next = vnode
        }

        const prevTree = instance.subTree
        const nextTree = normalizeVNode(render(setupState))
        instance.subTree = nextTree

        patch(prevTree, nextTree, hostParentNode(prevTree.el!)!, anchor)
        next.el = nextTree.el

        // updated hook
        if (u) {
          queuePostFlushCb(u)
        }
      }
    }

    const effect = (instance.effect = new ReactiveEffect(
      componentUpdateFn,
      () => queueJob(update),
      instance.scope,
    ))
    const update: SchedulerJob = (instance.update = () => effect.run())
    update.id = instance.uid
    update()
  }

  const updateComponent = (n1: VNode, n2: VNode) => {
    const instance = (n2.component = n1.component)!
    instance.next = n2
    instance.update()
  }

  const render: RootRenderFunction = (rootComponent, container) => {
    const vnode = createVNode(rootComponent, {}, [])
    patch(null, vnode, container, null)
    flushPostFlushCbs()
  }

  return { render }
}

// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
function getSequence(arr: number[]): number[] {
  const p = arr.slice()
  const result = [0]
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      while (u < v) {
        c = (u + v) >> 1
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}
