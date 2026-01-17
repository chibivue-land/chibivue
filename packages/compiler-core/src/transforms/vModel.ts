import { camelize } from "@chibivue/shared";

import {
  type SimpleExpressionNode,
  createCompoundExpression,
  createObjectProperty,
  createSimpleExpression,
} from "../ast";
import type { DirectiveTransform } from "../transform";

export const transformModel: DirectiveTransform = (dir, node, context) => {
  const { exp, arg } = dir;
  if (!exp) {
    // TODO: error handling
    throw new Error(`v-model is missing expression.`);
  }

  const propName = arg ? arg : createSimpleExpression("modelValue", true);
  const eventName = arg
    ? `onUpdate:${camelize((arg as SimpleExpressionNode).content)}`
    : `onUpdate:modelValue`;

  const assignmentExp = createCompoundExpression([`$event => ((`, exp, `) = $event)`]);

  const props = [
    // modelValue: foo
    createObjectProperty(propName, dir.exp!),
    // "onUpdate:modelValue": $event => (foo = $event)
    createObjectProperty(eventName, assignmentExp),
  ];

  return { props };
};
