import {
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  type ExpressionNode,
  NodeTypes,
  type ObjectExpression,
  type Property,
  type SlotsExpression,
  type TemplateChildNode,
  createCallExpression,
  createFunctionExpression,
  createObjectExpression,
  createObjectProperty,
  createSimpleExpression,
} from "../ast";
import { WITH_CTX } from "../runtimeHelpers";
import type { TransformContext } from "../transform";
import { findDir, isStaticExp, isTemplateNode } from "../utils";

// Build slots object for a component
export function buildSlots(
  node: ElementNode,
  context: TransformContext,
): {
  slots: SlotsExpression;
} {
  const { children } = node;
  const slotsProperties: Property[] = [];

  // 1. Check for slot with slotProps on component itself.
  //    <Comp v-slot="{ prop }"/>
  const onComponentSlot = findDir(node, "slot", true);
  if (onComponentSlot) {
    const { arg, exp } = onComponentSlot;
    slotsProperties.push(
      createObjectProperty(
        arg || createSimpleExpression("default", true),
        buildSlotFn(exp, children, node.loc, context),
      ),
    );
  }

  // 2. Iterate through children and check for template slots
  //    <template v-slot:foo="{ prop }">
  let hasTemplateSlots = false;
  const implicitDefaultChildren: TemplateChildNode[] = [];

  for (let i = 0; i < children.length; i++) {
    const slotElement = children[i];
    let slotDir: DirectiveNode | undefined;

    if (!isTemplateNode(slotElement) || !(slotDir = findDir(slotElement, "slot", true))) {
      // not a <template v-slot>, skip.
      if (slotElement.type !== NodeTypes.COMMENT) {
        implicitDefaultChildren.push(slotElement);
      }
      continue;
    }

    hasTemplateSlots = true;
    const { children: slotChildren, loc: slotLoc } = slotElement;
    const { arg: slotName = createSimpleExpression(`default`, true), exp: slotProps } = slotDir;

    const slotFunction = buildSlotFn(slotProps, slotChildren, slotLoc, context);
    slotsProperties.push(createObjectProperty(slotName, slotFunction));
  }

  if (!onComponentSlot) {
    if (!hasTemplateSlots) {
      // implicit default slot (on component)
      slotsProperties.push(
        createObjectProperty(`default`, buildSlotFn(undefined, children, node.loc, context)),
      );
    } else if (implicitDefaultChildren.length) {
      // implicit default slot (mixed with named slots)
      slotsProperties.push(
        createObjectProperty(
          `default`,
          buildSlotFn(undefined, implicitDefaultChildren, node.loc, context),
        ),
      );
    }
  }

  const slots = createObjectExpression(slotsProperties, node.loc) as SlotsExpression;

  return {
    slots,
  };
}

function buildSlotFn(
  props: ExpressionNode | undefined,
  children: TemplateChildNode[],
  loc: any,
  context: TransformContext,
) {
  const fn = createFunctionExpression(
    props,
    children,
    false /* newline */,
    children.length ? children[0].loc : loc,
  );
  fn.isSlot = true;
  return createCallExpression(context.helper(WITH_CTX), [fn], loc);
}
