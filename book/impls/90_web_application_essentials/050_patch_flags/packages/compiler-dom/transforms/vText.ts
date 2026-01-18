import {
  type DirectiveTransform,
  createObjectProperty,
  createSimpleExpression,
} from "../../compiler-core";

export const transformVText: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir;
  if (!exp) {
    console.error(`v-text is missing expression.`);
  }
  if (node.children.length) {
    console.error(`v-text will override element children.`);
    node.children.length = 0;
  }
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`textContent`, true),
        exp || createSimpleExpression("", true),
      ),
    ],
  };
};
