import { isArray, isString } from '../shared'
import {
  NodeTypes,
  RootNode,
  TemplateChildNode,
  ParentNode,
  Property,
  ElementNode,
  DirectiveNode,
} from './ast'
import { TransformOptions } from './options'

export type NodeTransform = (
  node: RootNode | TemplateChildNode,
  context: TransformContext,
) => void | (() => void) | (() => void)[]

export type DirectiveTransform = (
  dir: DirectiveNode,
  node: ElementNode,
  context: TransformContext,
) => DirectiveTransformResult

export interface DirectiveTransformResult {
  props: Property[]
}

export interface TransformContext extends Required<TransformOptions> {
  currentNode: RootNode | TemplateChildNode | null
  parent: ParentNode | null
  childIndex: number
}

export function createTransformContext(
  root: RootNode,
  { nodeTransforms = [], directiveTransforms = {} }: TransformOptions,
): TransformContext {
  const context: TransformContext = {
    nodeTransforms,
    directiveTransforms,
    currentNode: root,
    parent: null,
    childIndex: 0,
  }

  return context
}

export function transform(root: RootNode, options: TransformOptions) {
  const context = createTransformContext(root, options)
  traverseNode(root, context)
}

export function traverseNode(
  node: RootNode | TemplateChildNode,
  context: TransformContext,
) {
  context.currentNode = node

  const { nodeTransforms } = context
  const exitFns = []
  for (let i = 0; i < nodeTransforms.length; i++) {
    const onExit = nodeTransforms[i](node, context)
    if (onExit) {
      if (isArray(onExit)) {
        exitFns.push(...onExit)
      } else {
        exitFns.push(onExit)
      }
    }
    if (!context.currentNode) {
      return
    } else {
      node = context.currentNode
    }
  }

  switch (node.type) {
    case NodeTypes.INTERPOLATION:
      break
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      traverseChildren(node, context)
      break
  }

  context.currentNode = node
  let i = exitFns.length
  while (i--) {
    exitFns[i]()
  }
}

export function traverseChildren(
  parent: ParentNode,
  context: TransformContext,
) {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (isString(child)) continue
    context.parent = parent
    context.childIndex = i
    traverseNode(child, context)
  }
}
