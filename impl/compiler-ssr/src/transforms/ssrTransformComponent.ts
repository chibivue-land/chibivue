import {
  type ComponentNode,
  ElementTypes,
  type NodeTransform,
  NodeTypes,
  createCallExpression,
  createSimpleExpression,
} from "@chibivue/compiler-core";
import { SSR_RENDER_COMPONENT, SSR_RENDER_VNODE } from "../runtimeHelpers";
import type { SSRTransformContext } from "../ssrCodegenTransform";

export const ssrTransformComponent: NodeTransform = (node, context) => {
  if (
    node.type !== NodeTypes.ELEMENT ||
    node.tagType !== ElementTypes.COMPONENT
  ) {
    return;
  }

  return function ssrPostTransformComponent() {
    // Component SSR is handled at runtime
    // We just mark that it needs SSR rendering
  };
};

export function ssrProcessComponent(
  node: ComponentNode,
  context: SSRTransformContext,
  parent: { children: any[] },
): void {
  const component = node.tag;

  // Create a call to ssrRenderComponent
  // The component will be rendered at runtime using the SSR renderer
  const vnodeCall = createCallExpression(context.helper(SSR_RENDER_VNODE), [
    `_push`,
    createCallExpression(context.helper(SSR_RENDER_COMPONENT), [
      createSimpleExpression(`_component_${component}`, false),
      // props
      node.props.length
        ? createSimpleExpression(
            `{ ${node.props
              .filter((p) => p.type === NodeTypes.ATTRIBUTE)
              .map((p) => {
                const attr = p as { name: string; value?: { content: string } };
                return `${JSON.stringify(attr.name)}: ${
                  attr.value ? JSON.stringify(attr.value.content) : "true"
                }`;
              })
              .join(", ")} }`,
            false,
          )
        : createSimpleExpression(`null`, false),
      // slots - for now, null
      createSimpleExpression(`null`, false),
      // parent component
      `_parent`,
    ]),
    `_parent`,
  ]);

  context.pushStatement(vnodeCall);
}
