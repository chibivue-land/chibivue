import {
  CallExpression,
  DirectiveNode,
  ElementNode,
  ExpressionNode,
  NodeTypes,
  ObjectExpression,
  TemplateTextChildNode,
  VNodeCall,
  createCallExpression,
  createObjectExpression,
  createObjectProperty,
  createSimpleExpression,
  createVNodeCall,
} from '../ast'
import {
  MERGE_PROPS,
  NORMALIZE_CLASS,
  NORMALIZE_PROPS,
  NORMALIZE_STYLE,
  TO_HANDLERS,
} from '../runtimeHelpers'
import { NodeTransform, TransformContext } from '../transform'
import { isStaticExp } from '../utils'

export type PropsExpression = ObjectExpression | CallExpression | ExpressionNode

export const transformElement: NodeTransform = (node, context) => {
  return function postTransformElement() {
    node = context.currentNode!

    if (node.type !== NodeTypes.ELEMENT) return

    const { tag, props } = node

    const vnodeTag = `"${tag}"`
    let vnodeProps: VNodeCall['props']
    let vnodeChildren: VNodeCall['children']

    // props
    if (props.length > 0) {
      const propsBuildResult = buildProps(node, context)
      vnodeProps = propsBuildResult.props
    }

    // children
    if (node.children.length > 0) {
      if (node.children.length === 1) {
        const child = node.children[0]
        const type = child.type
        const hasDynamicTextChild = type === NodeTypes.INTERPOLATION

        if (hasDynamicTextChild || type === NodeTypes.TEXT) {
          vnodeChildren = child as TemplateTextChildNode
        } else {
          vnodeChildren = node.children
        }
      } else {
        vnodeChildren = node.children
      }
    }

    node.codegenNode = createVNodeCall(
      context,
      vnodeTag,
      vnodeProps,
      vnodeChildren,
    )
  }
}

export function buildProps(
  node: ElementNode,
  context: TransformContext,
): {
  props: PropsExpression | undefined
  directives: DirectiveNode[]
} {
  const { props, loc: elementLoc } = node
  let properties: ObjectExpression['properties'] = []
  const runtimeDirectives: DirectiveNode[] = []
  const mergeArgs: PropsExpression[] = []

  const pushMergeArg = (arg?: PropsExpression) => {
    if (properties.length) {
      mergeArgs.push(createObjectExpression(properties, elementLoc))
      properties = []
    }
    if (arg) mergeArgs.push(arg)
  }

  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const { name, value } = prop
      properties.push(
        createObjectProperty(
          createSimpleExpression(name, true),
          createSimpleExpression(value ? value.content : '', true),
        ),
      )
    } else {
      // directives
      const { name, arg, exp, loc } = prop
      const isVBind = name === 'bind'
      const isVOn = name === 'on'

      // special case for v-bind and v-on with no argument
      if (!arg && (isVBind || isVOn)) {
        if (exp) {
          if (isVBind) {
            pushMergeArg()
            mergeArgs.push(exp)
          } else {
            // v-on="obj" -> toHandlers(obj)
            pushMergeArg({
              type: NodeTypes.JS_CALL_EXPRESSION,
              loc,
              callee: context.helper(TO_HANDLERS),
              arguments: [exp],
            })
          }
        }
        continue
      }

      const directiveTransform = context.directiveTransforms[name]
      if (directiveTransform) {
        const { props } = directiveTransform(prop, node, context)
        if (isVOn && arg && !isStaticExp(arg)) {
          pushMergeArg(createObjectExpression(props, elementLoc))
        } else {
          properties.push(...props)
        }
      } else {
        // TODO: custom directive.
      }
    }
  }

  let propsExpression: PropsExpression | undefined = undefined

  // has v-bind="object" or v-on="object", wrap with mergeProps
  if (mergeArgs.length) {
    // close up any not-yet-merged props
    pushMergeArg()
    if (mergeArgs.length > 1) {
      propsExpression = createCallExpression(
        context.helper(MERGE_PROPS),
        mergeArgs,
        elementLoc,
      )
    } else {
      // single v-bind with nothing else - no need for a mergeProps call
      propsExpression = mergeArgs[0]
    }
  } else if (properties.length) {
    propsExpression = createObjectExpression(properties)
  }

  if (propsExpression) {
    switch (propsExpression.type) {
      case NodeTypes.JS_OBJECT_EXPRESSION:
        let classKeyIndex = -1
        let styleKeyIndex = -1

        for (let i = 0; i < propsExpression.properties.length; i++) {
          const key = propsExpression.properties[i].key
          if (isStaticExp(key)) {
            if (key.content === 'class') {
              classKeyIndex = i
            } else if (key.content === 'style') {
              styleKeyIndex = i
            }
          }
        }

        const classProp = propsExpression.properties[classKeyIndex]
        const styleProp = propsExpression.properties[styleKeyIndex]

        if (classProp && !isStaticExp(classProp.value)) {
          classProp.value = createCallExpression(
            context.helper(NORMALIZE_CLASS),
            [classProp.value],
          )
        }

        if (
          styleProp &&
          ((styleProp.value.type === NodeTypes.SIMPLE_EXPRESSION &&
            styleProp.value.content.trim()[0] === `[`) ||
            styleProp.value.type === NodeTypes.JS_ARRAY_EXPRESSION)
        ) {
          styleProp.value = createCallExpression(
            context.helper(NORMALIZE_STYLE),
            [styleProp.value],
          )
        } else {
          // dynamic key binding, wrap with `normalizeProps`
          propsExpression = createCallExpression(
            context.helper(NORMALIZE_PROPS),
            [propsExpression],
          )
        }
        break

      case NodeTypes.JS_CALL_EXPRESSION:
        // mergeProps call, do nothing
        break

      default:
        // single v-bind
        propsExpression = createCallExpression(
          context.helper(NORMALIZE_PROPS),
          [propsExpression],
        )
        break
    }
  }

  return {
    props: propsExpression,
    directives: runtimeDirectives,
  }
}
