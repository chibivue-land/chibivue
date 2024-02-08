import { ElementNode, NodeTypes, TemplateChildNode, TextNode } from './ast'

export const generate = ({
  children,
}: {
  children: TemplateChildNode[]
}): string => {
  return `return function render() {
  const { h } = ChibiVue;
  return ${genNode(children[0])};
}`
}

const genNode = (node: TemplateChildNode): string => {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      return genElement(node)
    case NodeTypes.TEXT:
      return genText(node)
    default:
      return ''
  }
}

const genElement = (el: ElementNode): string => {
  return `h("${el.tag}", {${el.props
    .map(({ name, value }) => `${name}: "${value?.content}"`)
    .join(', ')}}, [${el.children.map(it => genNode(it)).join(', ')}])`
}

const genText = (text: TextNode): string => {
  return `\`${text.content}\``
}
