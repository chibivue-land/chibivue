import {
  type DirectiveNode,
  type ElementNode,
  NodeTypes,
  type ObjectExpression,
  type TemplateTextChildNode,
  type VNodeCall,
  createObjectExpression,
  createObjectProperty,
  createSimpleExpression,
  createVNodeCall,
} from "../ast";
import type { NodeTransform } from "../transform";

export type PropsExpression = ObjectExpression;

export const transformElement: NodeTransform = (node, context) => {
  return function postTransformElement() {
    node = context.currentNode!;

    if (node.type !== NodeTypes.ELEMENT) return;

    const { tag, props } = node;

    const vnodeTag = `"${tag}"`;
    let vnodeProps: VNodeCall["props"];
    let vnodeChildren: VNodeCall["children"];

    // props
    if (props.length > 0) {
      const propsBuildResult = buildProps(node);
      vnodeProps = propsBuildResult.props;
    }

    // children
    if (node.children.length > 0) {
      if (node.children.length === 1) {
        const child = node.children[0];
        const type = child.type;
        const hasDynamicTextChild = type === NodeTypes.INTERPOLATION;

        if (hasDynamicTextChild || type === NodeTypes.TEXT) {
          vnodeChildren = child as TemplateTextChildNode;
        } else {
          vnodeChildren = node.children;
        }
      } else {
        vnodeChildren = node.children;
      }
    }

    node.codegenNode = createVNodeCall(vnodeTag, vnodeProps, vnodeChildren);
  };
};

export function buildProps(node: ElementNode): {
  props: PropsExpression | undefined;
  directives: DirectiveNode[];
} {
  const { props } = node;
  let properties: ObjectExpression["properties"] = [];
  const runtimeDirectives: DirectiveNode[] = [];

  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const { name, value } = prop;

      properties.push(
        createObjectProperty(
          createSimpleExpression(name, true),
          createSimpleExpression(value ? value.content : "", true),
        ),
      );
    } else {
      // directives
      // TODO:
    }
  }

  let propsExpression: PropsExpression | undefined = undefined;
  if (properties.length) {
    propsExpression = createObjectExpression(properties);
  }

  return {
    props: propsExpression,
    directives: runtimeDirectives,
  };
}
