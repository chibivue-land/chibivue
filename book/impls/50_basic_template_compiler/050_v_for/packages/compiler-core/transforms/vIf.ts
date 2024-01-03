import {
  DirectiveNode,
  ElementNode,
  IfBranchNode,
  IfConditionalExpression,
  IfNode,
  NodeTypes,
  SimpleExpressionNode,
  VNodeCall,
  createCallExpression,
  createConditionalExpression,
} from '../ast'
import { CREATE_COMMENT } from '../runtimeHelpers'
import {
  TransformContext,
  createStructuralDirectiveTransform,
  traverseNode,
} from '../transform'
import { processExpression } from './transformExpression'

export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  (node, dir, context) => {
    return processIf(node, dir, context, (ifNode, branch, isRoot) => {
      return () => {
        if (isRoot) {
          ifNode.codegenNode = createCodegenNodeForBranch(
            branch,
            context,
          ) as IfConditionalExpression
        } else {
          const parentCondition = getParentCondition(ifNode.codegenNode!)
          parentCondition.alternate = createCodegenNodeForBranch(
            branch,
            context,
          )
        }
      }
    })
  },
)

export function processIf(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (
    node: IfNode,
    branch: IfBranchNode,
    isRoot: boolean,
  ) => (() => void) | undefined,
) {
  if (!context.isBrowser && dir.exp) {
    dir.exp = processExpression(dir.exp as SimpleExpressionNode, context)
  }

  if (dir.name === 'if') {
    const branch = createIfBranch(node, dir)
    const ifNode: IfNode = {
      type: NodeTypes.IF,
      loc: node.loc,
      branches: [branch],
    }
    context.replaceNode(ifNode)
    if (processCodegen) {
      return processCodegen(ifNode, branch, true)
    }
  } else {
    const siblings = context.parent!.children
    let i = siblings.indexOf(node)
    while (i-- >= -1) {
      const sibling = siblings[i]
      if (sibling && sibling.type === NodeTypes.COMMENT) {
        context.removeNode(sibling)
        continue
      }

      if (
        sibling &&
        sibling.type === NodeTypes.TEXT &&
        !sibling.content.trim().length
      ) {
        context.removeNode(sibling)
        continue
      }

      if (sibling && sibling.type === NodeTypes.IF) {
        context.removeNode()
        const branch = createIfBranch(node, dir)
        sibling.branches.push(branch)
        const onExit = processCodegen && processCodegen(sibling, branch, false)
        traverseNode(branch, context)
        if (onExit) onExit()
        context.currentNode = null
      }
      break
    }
  }
}

function createIfBranch(node: ElementNode, dir: DirectiveNode): IfBranchNode {
  return {
    type: NodeTypes.IF_BRANCH,
    loc: node.loc,
    condition: dir.name === 'else' ? undefined : dir.exp,
    children: [node],
  }
}

function createCodegenNodeForBranch(
  branch: IfBranchNode,
  context: TransformContext,
): IfConditionalExpression | VNodeCall {
  if (branch.condition) {
    return createConditionalExpression(
      branch.condition,
      createChildrenCodegenNode(branch, context),
      createCallExpression(context.helper(CREATE_COMMENT), ['""', 'true']),
    ) as IfConditionalExpression
  } else {
    return createChildrenCodegenNode(branch, context)
  }
}

function createChildrenCodegenNode(
  branch: IfBranchNode,
  context: TransformContext,
): VNodeCall {
  const { children } = branch
  const firstChild = children[0]
  const vnodeCall = (firstChild as ElementNode).codegenNode as VNodeCall
  return vnodeCall
}

function getParentCondition(
  node: IfConditionalExpression,
): IfConditionalExpression {
  while (true) {
    if (node.type === NodeTypes.JS_CONDITIONAL_EXPRESSION) {
      if (node.alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION) {
        node = node.alternate
      } else {
        return node
      }
    }
  }
}
