import {
  type DirectiveTransform,
  createObjectProperty,
  createSimpleExpression,
} from "@chibivue/compiler-core";

export const transformVHtml: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir;
  if (!exp) {
    console.error(`v-html is missing expression.`);
  }
  if (node.children.length) {
    console.error(`v-html will override element children.`);
    node.children.length = 0;
  }
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`innerHTML`, true, loc),
        exp || createSimpleExpression("", true),
      ),
    ],
  };
};
