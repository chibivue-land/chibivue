import { transformOn as baseTransform } from '../../compiler-core/transforms/vOn'
import { DirectiveTransform } from '../../compiler-core/transform'
import { makeMap } from '../../shared/makeMap'
import {
  ExpressionNode,
  NodeTypes,
  SimpleExpressionNode,
  createCallExpression,
  createCompoundExpression,
  createObjectProperty,
  createSimpleExpression,
} from '../../compiler-core'
import {
  V_ON_WITH_KEYS,
  V_ON_WITH_MODIFIERS,
} from '../../runtime-dom/runtimeHelpers'
import { isStaticExp } from '../../compiler-core/utils'
import { capitalize } from '../../shared'

const isEventOptionModifier = makeMap(`passive,once,capture`)
const isNonKeyModifier = makeMap(
  // event propagation management
  `stop,prevent,self,` +
    // system modifiers + exact
    `ctrl,shift,alt,meta,exact,` +
    // mouse
    `middle`,
)

const maybeKeyModifier = makeMap('left,right')
const isKeyboardEvent = makeMap(`onkeyup,onkeydown,onkeypress`, true)

const resolveModifiers = (key: ExpressionNode, modifiers: string[]) => {
  const keyModifiers = []
  const nonKeyModifiers = []
  const eventOptionModifiers = []

  for (let i = 0; i < modifiers.length; i++) {
    const modifier = modifiers[i]

    if (isEventOptionModifier(modifier)) {
      eventOptionModifiers.push(modifier)
    } else {
      if (maybeKeyModifier(modifier)) {
        if (isStaticExp(key)) {
          if (isKeyboardEvent((key as SimpleExpressionNode).content)) {
            keyModifiers.push(modifier)
          } else {
            nonKeyModifiers.push(modifier)
          }
        } else {
          keyModifiers.push(modifier)
          nonKeyModifiers.push(modifier)
        }
      } else {
        if (isNonKeyModifier(modifier)) {
          nonKeyModifiers.push(modifier)
        } else {
          keyModifiers.push(modifier)
        }
      }
    }
  }

  return {
    keyModifiers,
    nonKeyModifiers,
    eventOptionModifiers,
  }
}

const transformClick = (key: ExpressionNode, event: string) => {
  const isStaticClick =
    isStaticExp(key) && key.content.toLowerCase() === 'onclick'
  return isStaticClick
    ? createSimpleExpression(event, true)
    : key.type !== NodeTypes.SIMPLE_EXPRESSION
      ? createCompoundExpression([
          `(`,
          key,
          `) === "onClick" ? "${event}" : (`,
          key,
          `)`,
        ])
      : key
}

export const transformOn: DirectiveTransform = (dir, node, context) => {
  return baseTransform(dir, node, context, baseResult => {
    const { modifiers } = dir
    if (!modifiers.length) return baseResult

    let { key, value: handlerExp } = baseResult.props[0]
    const { keyModifiers, nonKeyModifiers, eventOptionModifiers } =
      resolveModifiers(key, modifiers)

    if (nonKeyModifiers.includes('right')) {
      key = transformClick(key, `onContextmenu`)
    }
    if (nonKeyModifiers.includes('middle')) {
      key = transformClick(key, `onMouseup`)
    }

    if (nonKeyModifiers.length) {
      handlerExp = createCallExpression(context.helper(V_ON_WITH_MODIFIERS), [
        handlerExp,
        JSON.stringify(nonKeyModifiers),
      ])
    }

    if (
      keyModifiers.length &&
      (!isStaticExp(key) || isKeyboardEvent(key.content))
    ) {
      handlerExp = createCallExpression(context.helper(V_ON_WITH_KEYS), [
        handlerExp,
        JSON.stringify(keyModifiers),
      ])
    }

    if (eventOptionModifiers.length) {
      const modifierPostfix = eventOptionModifiers.map(capitalize).join('')
      key = isStaticExp(key)
        ? createSimpleExpression(`${key.content}${modifierPostfix}`, true)
        : createCompoundExpression([`(`, key, `) + "${modifierPostfix}"`])
    }

    return {
      props: [createObjectProperty(key, handlerExp)],
    }
  })
}
