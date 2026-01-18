import { type CompilerOptions, baseCompile, baseParse } from "../compiler-core";
import type { DirectiveTransform } from "../compiler-core/transform";
import { transformOn } from "./transforms/vOn";

const DOMDirectiveTransforms: Record<string, DirectiveTransform> = {
  on: transformOn, // override compiler-core
};

export function compile(template: string, option?: CompilerOptions) {
  const defaultOption = { isBrowser: true };
  if (option) Object.assign(defaultOption, option);
  return baseCompile(
    template,
    Object.assign({}, defaultOption, {
      directiveTransforms: DOMDirectiveTransforms,
    }),
  );
}

export function parse(template: string) {
  return baseParse(template);
}
