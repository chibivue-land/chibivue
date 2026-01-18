import { type CompilerOptions, baseCompile, baseParse } from "../compiler-core";
import type { DirectiveTransform } from "../compiler-core/transform";
import { parserOptions } from "./parserOptions";
import { transformOn } from "./transforms/vOn";
import { transformVText } from "./transforms/vText";
import { transformVHtml } from "./transforms/vHtml";

const DOMDirectiveTransforms: Record<string, DirectiveTransform> = {
  on: transformOn, // override compiler-core
  text: transformVText,
  html: transformVHtml,
};

export function compile(template: string, option?: CompilerOptions) {
  const defaultOption = { isBrowser: true };
  if (option) Object.assign(defaultOption, option);
  return baseCompile(
    template,
    Object.assign({}, parserOptions, defaultOption, {
      directiveTransforms: DOMDirectiveTransforms,
    }),
  );
}

export function parse(template: string) {
  return baseParse(template);
}
