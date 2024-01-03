import { type RendererOptions } from '@chibivue/runtime-core'

export const nodeOps: Omit<RendererOptions, 'patchProp'> = {
  createElement: tagName => {
    return document.createElement(tagName)
  },

  createText: (text: string) => {
    return document.createTextNode(text)
  },

  createComment: (text: string) => {
    return document.createComment(text)
  },

  setText: (node, text) => {
    node.nodeValue = text
  },

  setElementText: (el, text) => {
    el.textContent = text
  },

  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null)
  },

  remove: child => {
    const parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  },

  parentNode: node => {
    return node.parentNode
  },

  nextSibling: node => {
    return node.nextSibling
  },
}
