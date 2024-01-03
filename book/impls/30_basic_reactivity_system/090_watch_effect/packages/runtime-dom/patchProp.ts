import { RendererOptions } from '../runtime-core'
import { patchAttr } from './modules/attrs'
import { patchEvent } from './modules/events'
import { patchDOMProp } from './modules/props'
import { patchStyle } from './modules/style'

type DOMRendererOptions = RendererOptions<Node, Element>

const onRE = /^on[^a-z]/
export const isOn = (key: string) => onRE.test(key)

export const patchProp: DOMRendererOptions['patchProp'] = (
  el,
  key,
  prevValue,
  nextValue,
  prevChildren,
  unmountChildren,
) => {
  if (key === 'style') {
    patchStyle(el, prevValue, nextValue)
  } else if (isOn(key)) {
    patchEvent(el, key, nextValue)
  } else if (shouldSetAsProp(el, key)) {
    patchDOMProp(el, key, nextValue, prevChildren, unmountChildren)
  } else {
    patchAttr(el, key, nextValue)
  }
}

function shouldSetAsProp(el: Element, key: string) {
  // these are enumerated attrs, however their corresponding DOM properties
  // are actually booleans - this leads to setting it with a string "false"
  // value leading it to be coerced to `true`, so we need to always treat
  // them as attributes.
  // Note that `contentEditable` doesn't have this problem: its DOM
  // property is also enumerated string values.
  if (key === 'spellcheck' || key === 'draggable' || key === 'translate') {
    return false
  }

  // form property on form elements is readonly and must be set as
  // attribute.
  if (key === 'form') {
    return false
  }

  // <input list> must be set as attribute
  if (key === 'list' && el.tagName === 'INPUT') {
    return false
  }

  // <textarea type> must be set as attribute
  if (key === 'type' && el.tagName === 'TEXTAREA') {
    return false
  }

  return key in el
}
