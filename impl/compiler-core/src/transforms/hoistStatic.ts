import { NodeTypes } from "../ast";
import type {
  CallExpression,
  ElementNode,
  PlainElementNode,
  RootNode,
  TemplateChildNode,
  VNodeCall,
} from "../ast";
import type { TransformContext } from "../transform";

export const enum ConstantTypes {
  NOT_CONSTANT = 0,
  CAN_SKIP_PATCH = 1,
  CAN_HOIST = 2,
  CAN_STRINGIFY = 3,
}

export function hoistStatic(root: RootNode, context: TransformContext): void {
  walk(root, context, new Map());
}

function walk(
  node: RootNode | TemplateChildNode,
  context: TransformContext,
  resultCache: Map<TemplateChildNode, ConstantTypes>,
): void {
  const { children } = node as RootNode | ElementNode;
  if (!children) return;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (
      child.type === NodeTypes.ELEMENT &&
      child.tagType === 0 // ElementTypes.ELEMENT
    ) {
      const constantType = getConstantType(child, context, resultCache);
      if (constantType > ConstantTypes.NOT_CONSTANT) {
        if (constantType >= ConstantTypes.CAN_HOIST) {
          const codegenNode = child.codegenNode as VNodeCall | undefined;
          if (codegenNode && codegenNode.type === NodeTypes.VNODE_CALL) {
            codegenNode.isStatic = true;
            context.hoists.push(codegenNode as unknown as TemplateChildNode);
            child.codegenNode = context.hoist(
              codegenNode as unknown as TemplateChildNode,
            ) as unknown as VNodeCall;
          }
        }
      } else {
        walk(child, context, resultCache);
      }
    }
  }
}

export function getConstantType(
  node: TemplateChildNode,
  context: TransformContext,
  resultCache: Map<TemplateChildNode, ConstantTypes>,
): ConstantTypes {
  const cached = resultCache.get(node);
  if (cached !== undefined) {
    return cached;
  }

  if (node.type === NodeTypes.ELEMENT) {
    if (node.tagType !== 0) {
      // not a plain element
      resultCache.set(node, ConstantTypes.NOT_CONSTANT);
      return ConstantTypes.NOT_CONSTANT;
    }

    const element = node as PlainElementNode;
    const codegenNode = element.codegenNode;

    if (!codegenNode || codegenNode.type !== NodeTypes.VNODE_CALL) {
      resultCache.set(node, ConstantTypes.NOT_CONSTANT);
      return ConstantTypes.NOT_CONSTANT;
    }

    // Check if it has dynamic props
    if (codegenNode.props) {
      const propsType = codegenNode.props.type;
      if (propsType !== NodeTypes.JS_OBJECT_EXPRESSION) {
        resultCache.set(node, ConstantTypes.NOT_CONSTANT);
        return ConstantTypes.NOT_CONSTANT;
      }

      const properties = codegenNode.props.properties;
      for (let i = 0; i < properties.length; i++) {
        const { key, value } = properties[i];
        if (key.type !== NodeTypes.SIMPLE_EXPRESSION || !key.isStatic) {
          resultCache.set(node, ConstantTypes.NOT_CONSTANT);
          return ConstantTypes.NOT_CONSTANT;
        }
        if (value.type !== NodeTypes.SIMPLE_EXPRESSION || !value.isStatic) {
          resultCache.set(node, ConstantTypes.NOT_CONSTANT);
          return ConstantTypes.NOT_CONSTANT;
        }
      }
    }

    // Check children
    if (element.children) {
      for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i];
        const childType = getConstantType(child, context, resultCache);
        if (childType === ConstantTypes.NOT_CONSTANT) {
          resultCache.set(node, ConstantTypes.NOT_CONSTANT);
          return ConstantTypes.NOT_CONSTANT;
        }
      }
    }

    // Check directives
    if (element.props && element.props.length > 0) {
      for (const prop of element.props) {
        if (prop.type === NodeTypes.DIRECTIVE) {
          // Has directive, not constant
          resultCache.set(node, ConstantTypes.NOT_CONSTANT);
          return ConstantTypes.NOT_CONSTANT;
        }
      }
    }

    resultCache.set(node, ConstantTypes.CAN_HOIST);
    return ConstantTypes.CAN_HOIST;
  }

  if (node.type === NodeTypes.TEXT) {
    resultCache.set(node, ConstantTypes.CAN_STRINGIFY);
    return ConstantTypes.CAN_STRINGIFY;
  }

  if (node.type === NodeTypes.INTERPOLATION) {
    resultCache.set(node, ConstantTypes.NOT_CONSTANT);
    return ConstantTypes.NOT_CONSTANT;
  }

  resultCache.set(node, ConstantTypes.NOT_CONSTANT);
  return ConstantTypes.NOT_CONSTANT;
}
