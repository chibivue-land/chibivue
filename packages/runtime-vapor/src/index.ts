import type { RootRenderFunction, VNode } from '@chibivue/runtime-core'
import { createRenderer } from '@chibivue/runtime-core'
import { nodeOps, patchProp } from '@chibivue/runtime-dom'

import type { VaporComponentInternalInstance } from './component'

export * from './component'

export type VaporNode = Element & { __is_vapor: true }

export const template = (tmp: string): VaporNode => {
  const container = document.createElement('div')
  container.innerHTML = tmp
  const el = container.firstElementChild as VaporNode
  el.__is_vapor = true
  return el
}

export const setText = (target: Element, format: string, ...values: any[]) => {
  const fmt = (): string => {
    let text = format
    for (let i = 0; i < values.length; i++) {
      text = text.replace('{}', values[i])
    }
    return text
  }

  if (!target) return

  if (!values.length) {
    target.textContent = fmt()
    return
  }

  if (!format && values.length) {
    target.textContent = values.join('')
    return
  }

  target.textContent = fmt()
}

export const on = (element: Element, event: string, callback: () => void) => {
  element.addEventListener(event, callback)
}

/*
 *
 * for non vapor component
 *
 */

const renderer = createRenderer({ ...nodeOps, patchProp })

const render = ((...args) =>
  renderer.render(...args)) as RootRenderFunction<Element>

export const createComponent = (
  self: VaporComponentInternalInstance,
  component: VNode,
  container: VaporNode,
) => render(component, container, self)
