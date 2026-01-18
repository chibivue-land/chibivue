import { transformOn as baseTransform } from "../../compiler-core/transforms/vOn";
import type { DirectiveTransform } from "../../compiler-core/transform";
import { makeMap } from "../../shared/makeMap";
import { createCallExpression, createObjectProperty } from "../../compiler-core";
import { V_ON_WITH_MODIFIERS } from "../../runtime-dom/runtimeHelpers";

const isEventModifier = makeMap(
  // event propagation management
  `stop,prevent,self`,
);

const resolveModifiers = (modifiers: string[]) => {
  const eventModifiers = [];

  for (let i = 0; i < modifiers.length; i++) {
    const modifier = modifiers[i];
    if (isEventModifier(modifier)) {
      eventModifiers.push(modifier);
    }
  }

  return { eventModifiers };
};

export const transformOn: DirectiveTransform = (dir, node, context) => {
  return baseTransform(dir, node, context, (baseResult) => {
    const { modifiers } = dir;
    if (!modifiers.length) return baseResult;

    let { key, value: handlerExp } = baseResult.props[0];
    const { eventModifiers } = resolveModifiers(modifiers);

    if (eventModifiers.length) {
      handlerExp = createCallExpression(context.helper(V_ON_WITH_MODIFIERS), [
        handlerExp,
        JSON.stringify(eventModifiers),
      ]);
    }

    return {
      props: [createObjectProperty(key, handlerExp)],
    };
  });
};
