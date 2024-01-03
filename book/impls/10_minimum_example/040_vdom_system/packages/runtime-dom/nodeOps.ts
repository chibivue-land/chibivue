import { RendererOptions } from '../runtime-core'

export const nodeOps: Omit<RendererOptions<Node, Element>, 'patchProp'> = {
  createElement: tagName => {
    return document.createElement(tagName)
  },

  createText: text => {
    return document.createTextNode(text)
  },

  setText: (node, text) => {
    node.nodeValue = text
  },

  setElementText(node, text) {
    node.textContent = text
  },

  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null)
  },
}
