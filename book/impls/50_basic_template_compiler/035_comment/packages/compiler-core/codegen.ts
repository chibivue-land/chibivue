import { isArray, isString, isSymbol } from '../shared'
import {
  ArrayExpression,
  CallExpression,
  CommentNode,
  CompoundExpressionNode,
  ExpressionNode,
  InterpolationNode,
  JSChildNode,
  NodeTypes,
  ObjectExpression,
  RootNode,
  SimpleExpressionNode,
  TemplateChildNode,
  TextNode,
  VNodeCall,
} from './ast'
import { CompilerOptions } from './options'
import { CREATE_COMMENT, CREATE_VNODE, helperNameMap } from './runtimeHelpers'

const CONSTANT = { ctxIdent: '_ctx' }

const aliasHelper = (s: symbol) => `${helperNameMap[s]}: _${helperNameMap[s]}`

type CodegenNode = TemplateChildNode | JSChildNode

export interface CodegenContext {
  source: string
  code: string
  indentLevel: number
  line: 1
  column: 1
  offset: 0
  runtimeGlobalName: string
  helper(key: symbol): string
  push(code: string, node?: CodegenNode): void
  indent(): void
  deindent(withoutNewLine?: boolean): void
  newline(): void
}

function createCodegenContext(ast: RootNode): CodegenContext {
  const context: CodegenContext = {
    source: ast.loc.source,
    code: '',
    column: 1,
    line: 1,
    offset: 0,
    indentLevel: 0,
    runtimeGlobalName: 'ChibiVue',
    helper(key) {
      return `_${helperNameMap[key]}`
    },
    push(code) {
      context.code += code
    },
    indent() {
      newline(++context.indentLevel)
    },
    deindent(withoutNewLine = false) {
      if (withoutNewLine) {
        --context.indentLevel
      } else {
        newline(--context.indentLevel)
      }
    },
    newline() {
      newline(context.indentLevel)
    },
  }

  function newline(n: number) {
    context.push('\n' + `  `.repeat(n))
  }

  return context
}

export const generate = (ast: RootNode, option: CompilerOptions): string => {
  const context = createCodegenContext(ast)

  const { push } = context

  const args = [CONSTANT.ctxIdent]
  const signature = args.join(', ')

  if (option.isBrowser) {
    push('return ')
  }
  push(`function render(${signature}) { `)

  if (option.isBrowser) {
    context.indent()
    push(`with (_ctx) {`)
  }

  context.indent()
  genFunctionPreamble(ast, context) // NOTE: 将来的には関数の外に出す

  push(`return `)
  if (ast.codegenNode) {
    genNode(ast.codegenNode, context, option)
  } else {
    push(`null`)
  }

  context.deindent()
  push(` }`)

  if (option.isBrowser) {
    context.deindent()
    push(` }`)
  }

  return context.code
}

function genFunctionPreamble(ast: RootNode, context: CodegenContext) {
  const { push, newline, runtimeGlobalName } = context
  const helpers = Array.from(ast.helpers)
  push(
    `const { ${helpers.map(aliasHelper).join(', ')} } = ${runtimeGlobalName}\n`,
  )
  newline()
}

const genNode = (
  node: CodegenNode,
  context: CodegenContext,
  option: CompilerOptions,
) => {
  if (isString(node)) {
    context.push(node)
    return
  }

  if (isSymbol(node)) {
    context.push(context.helper(node))
    return
  }

  switch (node.type) {
    case NodeTypes.ELEMENT:
      genNode(node.codegenNode!, context, option)
      break
    case NodeTypes.TEXT:
      genText(node, context)
      break
    case NodeTypes.SIMPLE_EXPRESSION:
      genExpression(node, context)
      break
    case NodeTypes.INTERPOLATION:
      genInterpolation(node, context, option)
      break
    case NodeTypes.VNODE_CALL:
      genVNodeCall(node, context, option)
      break
    case NodeTypes.COMPOUND_EXPRESSION:
      genCompoundExpression(node, context, option)
      break
    case NodeTypes.COMMENT:
      genComment(node, context)
      break
    case NodeTypes.JS_CALL_EXPRESSION:
      genCallExpression(node, context, option)
      break
    case NodeTypes.JS_OBJECT_EXPRESSION:
      genObjectExpression(node, context, option)
      break
    case NodeTypes.JS_ARRAY_EXPRESSION:
      genArrayExpression(node, context, option)
      break
    default:
      // make sure we exhaust all possible types
      const exhaustiveCheck: never = node
      return exhaustiveCheck
  }
}

function genText(node: TextNode, context: CodegenContext) {
  context.push(JSON.stringify(node.content), node)
}

function genExpression(node: SimpleExpressionNode, context: CodegenContext) {
  const { content, isStatic } = node
  context.push(isStatic ? JSON.stringify(content) : content, node)
}

function genInterpolation(
  node: InterpolationNode,
  context: CodegenContext,
  option: CompilerOptions,
) {
  genNode(node.content, context, option)
}

function genCompoundExpression(
  node: CompoundExpressionNode,
  context: CodegenContext,
  option: CompilerOptions,
) {
  for (let i = 0; i < node.children!.length; i++) {
    const child = node.children![i]
    if (isString(child)) {
      context.push(child)
    } else {
      genNode(child, context, option)
    }
  }
}

function genExpressionAsPropertyKey(
  node: ExpressionNode,
  context: CodegenContext,
  option: CompilerOptions,
) {
  const { push } = context
  if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
    push(`[`)
    genCompoundExpression(node, context, option)
    push(`]`)
  } else if (node.isStatic) {
    push(JSON.stringify(node.content), node)
  } else {
    push(`[${node.content}]`, node)
  }
}

function genComment(node: CommentNode, context: CodegenContext) {
  const { push, helper } = context
  push(`${helper(CREATE_COMMENT)}(${JSON.stringify(node.content)})`, node)
}

function genVNodeCall(
  node: VNodeCall,
  context: CodegenContext,
  option: CompilerOptions,
) {
  const { push, helper } = context
  const { tag, props, children } = node

  push(helper(CREATE_VNODE) + `(`, node)
  genNodeList(genNullableArgs([tag, props, children]), context, option)
  push(`)`)
}

function genNullableArgs(args: any[]): CallExpression['arguments'] {
  let i = args.length
  while (i--) {
    if (args[i] != null) break
  }
  return args.slice(0, i + 1).map(arg => arg || `null`)
}

function genCallExpression(
  node: CallExpression,
  context: CodegenContext,
  option: CompilerOptions,
) {
  const { push, helper } = context
  const callee = isString(node.callee) ? node.callee : helper(node.callee)
  push(callee + `(`, node)
  genNodeList(node.arguments, context, option)
  push(`)`)
}

function genObjectExpression(
  node: ObjectExpression,
  context: CodegenContext,
  option: CompilerOptions,
) {
  const { push } = context
  const { properties } = node

  if (!properties.length) {
    push(`{}`, node)
    return
  }

  push(`{ `)
  for (let i = 0; i < properties.length; i++) {
    const { key, value } = properties[i]
    // key
    genExpressionAsPropertyKey(key, context, option)
    push(`: `)
    // value
    genNode(value, context, option)
    if (i < properties.length - 1) {
      push(`,`)
    }
  }
  push(` }`)
}

function genArrayExpression(
  node: ArrayExpression,
  context: CodegenContext,
  option: CompilerOptions,
) {
  genNodeListAsArray(node.elements as CodegenNode[], context, option)
}

function genNodeListAsArray(
  nodes: (string | CodegenNode | TemplateChildNode[])[],
  context: CodegenContext,
  option: CompilerOptions,
) {
  context.push(`[`)
  genNodeList(nodes, context, option)
  context.push(`]`)
}

function genNodeList(
  nodes: (string | CodegenNode | TemplateChildNode[])[],
  context: CodegenContext,
  option: CompilerOptions,
  comma: boolean = true,
) {
  const { push } = context
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (isString(node)) {
      push(node)
    } else if (isArray(node)) {
      genNodeListAsArray(node, context, option)
    } else {
      genNode(node, context, option)
    }

    if (i < nodes.length - 1) {
      comma && push(', ')
    }
  }
}
