import {
  DirectiveNode,
  ExpressionNode,
  NodeTypes,
  SimpleExpressionNode,
  createCompoundExpression,
  createObjectProperty,
  createSimpleExpression,
} from '../ast'
import { TO_HANDLER_KEY } from '../runtimeHelpers'
import { DirectiveTransform, DirectiveTransformResult } from '../transform'
import { isMemberExpression } from '../utils'
import { processExpression } from './transformExpression'

const fnExpRE =
  /^\s*([\w$_]+|(async\s*)?\([^)]*?\))\s*(:[^=]+)?=>|^\s*(async\s+)?function(?:\s+[\w$]+)?\s*\(/

export interface VOnDirectiveNode extends DirectiveNode {
  arg: ExpressionNode
  exp: SimpleExpressionNode | undefined
}

export const transformOn: DirectiveTransform = (dir, _node, context) => {
  const { arg } = dir as VOnDirectiveNode

  let eventName: ExpressionNode
  if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
    eventName = createCompoundExpression([
      `${context.helperString(TO_HANDLER_KEY)}(`,
      arg,
      `)`,
    ])
  } else {
    // already a compound expression.
    eventName = arg
    eventName.children.unshift(`${context.helperString(TO_HANDLER_KEY)}(`)
    eventName.children.push(`)`)
  }

  // handler processing
  let exp: ExpressionNode | undefined = dir.exp as
    | SimpleExpressionNode
    | undefined
  if (exp && !exp.content?.trim()) {
    exp = undefined
  }
  if (exp) {
    const isMemberExp = isMemberExpression(exp.content)
    const isInlineStatement = !(isMemberExp || fnExpRE.test(exp.content))
    const hasMultipleStatements = exp.content.includes(`;`)

    if (!context.isBrowser) {
      isInlineStatement && context.addIdentifiers(`$event`)
      exp = dir.exp = processExpression(exp, context)
      isInlineStatement && context.removeIdentifiers(`$event`)
    }

    if (isInlineStatement) {
      // wrap inline statement in a function expression
      exp = createCompoundExpression([
        `$event => ${hasMultipleStatements ? `{` : `(`}`,
        exp,
        hasMultipleStatements ? `}` : `)`,
      ])
    }
  }

  let ret: DirectiveTransformResult = {
    props: [
      createObjectProperty(
        eventName,
        exp || createSimpleExpression(`() => {}`),
      ),
    ],
  }

  return ret
}
