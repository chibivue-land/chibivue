import { isOn } from '@chibivue/shared'
import { patchEvent } from './modules/events'
import { type RendererOptions } from '@chibivue/runtime-core'
import { patchAttr } from './modules/attrs'
import { patchStyle } from './modules/style'

type DOMRendererOptions = RendererOptions<Node, Element>

export const patchProp: DOMRendererOptions['patchProp'] = (
  el,
  key,
  prevValue,
  nextValue,
) => {
  // if (key === "class") {
  //   // TODO: patch class
  // }
  if (key === 'style') {
    patchStyle(el, prevValue, nextValue)
  } else if (isOn(key)) {
    patchEvent(el, key, nextValue)
  } else {
    patchAttr(el, key, nextValue)
  }
}
