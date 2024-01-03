import { toHandlerKey } from '../shared'
import {
  AttributeNode,
  DirectiveNode,
  ElementNode,
  InterpolationNode,
  NodeTypes,
  TemplateChildNode,
  TextNode,
} from './ast'
import { CompilerOptions } from './options'

export const generate = (
  {
    children,
  }: {
    children: TemplateChildNode[]
  },
  option: Required<CompilerOptions>,
): string => {
  return `${option.isBrowser ? 'return ' : ''}function render(_ctx) {
  ${option.isBrowser ? 'with (_ctx) {' : ''}
    const { h } = ChibiVue;
    return ${genNode(children[0], option)};
  ${option.isBrowser ? '}' : ''}
}`
}

const genNode = (
  node: TemplateChildNode,
  option: Required<CompilerOptions>,
): string => {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      return genElement(node, option)
    case NodeTypes.TEXT:
      return genText(node)
    case NodeTypes.INTERPOLATION:
      return genInterpolation(node, option)
    default:
      return ''
  }
}

const genElement = (
  el: ElementNode,
  option: Required<CompilerOptions>,
): string => {
  return `h("${el.tag}", {${el.props
    .map(prop => genProp(prop, option))
    .join(', ')}}, [${el.children.map(it => genNode(it, option)).join(', ')}])`
}

const genProp = (
  prop: AttributeNode | DirectiveNode,
  option: Required<CompilerOptions>,
): string => {
  switch (prop.type) {
    case NodeTypes.ATTRIBUTE:
      return `${prop.name}: "${prop.value?.content}"`
    case NodeTypes.DIRECTIVE: {
      switch (prop.name) {
        case 'on':
          return `${toHandlerKey(prop.arg)}: ${
            option.isBrowser ? '' : '_ctx.'
          }${prop.exp}`
        default:
          // TODO: other directives
          throw new Error(`unexpected directive name. got "${prop.name}"`)
      }
    }
    default:
      throw new Error(`unexpected prop type.`)
  }
}

const genText = (text: TextNode): string => {
  return `\`${text.content}\``
}

const genInterpolation = (
  node: InterpolationNode,
  option: Required<CompilerOptions>,
): string => {
  return `${option.isBrowser ? '' : '_ctx.'}${node.content}`
}
