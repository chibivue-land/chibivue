import { isSymbol } from '@chibivue/shared'

import {
  ArrayExpression,
  CallExpression,
  ComponentNode,
  DirectiveArguments,
  DirectiveNode,
  ElementNode,
  ElementTypes,
  ExpressionNode,
  NodeTypes,
  ObjectExpression,
  TemplateTextChildNode,
  VNodeCall,
  createArrayExpression,
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
  RESOLVE_COMPONENT,
  TO_HANDLERS,
} from '../runtimeHelpers'
import { NodeTransform, TransformContext } from '../transform'
import { isStaticExp } from '../utils'

const directiveImportMap = new WeakMap<DirectiveNode, symbol>()

export type PropsExpression = ObjectExpression | CallExpression | ExpressionNode

export const transformElement: NodeTransform = (node, context) => {
  return function postTransformElement() {
    node = context.currentNode!

    if (
      !(
        node.type === NodeTypes.ELEMENT &&
        (node.tagType === ElementTypes.ELEMENT ||
          node.tagType === ElementTypes.COMPONENT)
      )
    ) {
      return
    }

    const { tag, props } = node
    const isComponent = node.tagType === ElementTypes.COMPONENT

    const vnodeTag = isComponent
      ? resolveComponentType(node as ComponentNode, context)
      : `"${tag}"`
    let vnodeProps: VNodeCall['props']
    let vnodeDirectives: VNodeCall['directives']
    let vnodeChildren: VNodeCall['children']

    // props
    if (props.length > 0) {
      const propsBuildResult = buildProps(node, context)
      vnodeProps = propsBuildResult.props

      const directives = propsBuildResult.directives
      vnodeDirectives = directives.length
        ? (createArrayExpression(
            directives.map(dir => buildDirectiveArgs(dir, context)),
          ) as DirectiveArguments)
        : undefined
    }

    // children
    if (node.children.length > 0) {
      if (node.children.length === 1) {
        const child = node.children[0]
        const type = child.type
        // check for dynamic text children
        const hasDynamicTextChild = type === NodeTypes.INTERPOLATION

        // pass directly if the only child is a text node
        // (plain / interpolation / expression)
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
      vnodeDirectives,
      isComponent,
    )
  }
}

export function buildProps(
  node: ElementNode,
  context: TransformContext,
): { props: PropsExpression | undefined; directives: DirectiveNode[] } {
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
        // has built-in directive transform.
        const { props, needRuntime } = directiveTransform(prop, node, context)
        if (isVOn && arg && !isStaticExp(arg)) {
          pushMergeArg(createObjectExpression(props, elementLoc))
        } else {
          properties.push(...props)
        }
        if (needRuntime) {
          runtimeDirectives.push(prop)
          if (isSymbol(needRuntime)) {
            directiveImportMap.set(prop, needRuntime)
          }
        }
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

export function buildDirectiveArgs(
  dir: DirectiveNode,
  context: TransformContext,
): ArrayExpression {
  const dirArgs: ArrayExpression['elements'] = []
  const runtime = directiveImportMap.get(dir)
  if (runtime) {
    dirArgs.push(context.helperString(runtime))
  }
  if (dir.exp) dirArgs.push(dir.exp)
  if (dir.arg) {
    if (!dir.exp) {
      dirArgs.push(`void 0`)
    }
    dirArgs.push(dir.arg)
  }
  return createArrayExpression(dirArgs, dir.loc)
}

export function resolveComponentType(
  node: ComponentNode,
  context: TransformContext,
) {
  let { tag } = node

  // TODO: 1. dynamic component

  // TODO: 1.5 v-is (TODO: Deprecate)

  // TODO: 2. built-in components (Teleport, Transition, KeepAlive, Suspense...)

  // TODO: 3. user component (from setup bindings)

  // TODO: 4. Self referencing component (inferred from filename)
  context.helper(RESOLVE_COMPONENT)

  // 5. user component (resolve)
  context.components.add(tag)
  return toValidAssetId(tag, `component`)
}

export function toValidAssetId(
  name: string,
  type: 'component' | 'directive' | 'filter',
): string {
  return `_${type}_${name.replace(/[^\w]/g, (searchValue, replaceValue) => {
    return searchValue === '-' ? '_' : name.charCodeAt(replaceValue).toString()
  })}`
}
