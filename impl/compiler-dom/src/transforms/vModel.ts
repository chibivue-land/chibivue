import type { DirectiveTransform } from "@chibivue/compiler-core";
import {
  ElementTypes,
  NodeTypes,
  transformModel as baseTransform,
  findProp,
} from "@chibivue/compiler-core";

import { V_MODEL_DYNAMIC, V_MODEL_TEXT } from "../runtimeHelpers";

export const transformModel: DirectiveTransform = (dir, node, context) => {
  const baseResult = baseTransform(dir, node, context);

  // base transform has errors OR component v-model (only need props)
  if (!baseResult.props.length || node.tagType === ElementTypes.COMPONENT) {
    return baseResult;
  }

  const { tag } = node;
  if (tag === "input" || tag === "textarea") {
    let directiveToUse = V_MODEL_TEXT;
    if (tag === "input") {
      const type = findProp(node, `type`);
      if (type) {
        if (type.type === NodeTypes.DIRECTIVE) {
          directiveToUse = V_MODEL_DYNAMIC;
        }
      }
    }
    baseResult.needRuntime = context.helper(directiveToUse);
  }

  // native v-model doesn't need the `modelValue` props since they are also
  baseResult.props = baseResult.props.filter(
    (p) => !(p.key.type === NodeTypes.SIMPLE_EXPRESSION && p.key.content === "modelValue"),
  );

  return baseResult;
};
