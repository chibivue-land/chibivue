import type { DirectiveTransform } from "@chibivue/compiler-core";
import { V_SHOW } from "../runtimeHelpers";

export const transformShow: DirectiveTransform = (dir, _node, context) => {
  const { exp, loc } = dir;
  if (!exp) {
    console.error(`v-show is missing expression.`, loc);
  }

  return {
    props: [],
    needRuntime: context.helper(V_SHOW),
  };
};
