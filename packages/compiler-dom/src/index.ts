import type {
  CompilerOptions,
  DirectiveTransform,
  ParserOptions,
  RootNode,
} from "@chibivue/compiler-core";
import { baseCompile, baseParse } from "@chibivue/compiler-core";

import type { CodegenResult } from "./codegen";
import { parserOptions } from "./parserOptions";
import { transformModel } from "./transforms/vModel";
import { transformOn } from "./transforms/vOn";
import { transformVText } from "./transforms/vText";
import { transformVHtml } from "./transforms/vHtml";

export const DOMDirectiveTransforms: Record<string, DirectiveTransform> = {
  on: transformOn,
  model: transformModel, // override compiler-core
  text: transformVText,
  html: transformVHtml,
};

export function compile(template: string, options: CompilerOptions): CodegenResult {
  return baseCompile(template, {
    ...options,
    ...parserOptions,
    directiveTransforms: {
      ...options.directiveTransforms,
      ...DOMDirectiveTransforms,
    },
  }) as any;
}

export function parse(template: string, options: ParserOptions = {}): RootNode {
  return baseParse(template, { ...options, ...parserOptions });
}
