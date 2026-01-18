import { generate } from "./codegen";
import type { CompilerOptions } from "./options";
import { baseParse } from "./parse";
import { type DirectiveTransform, type NodeTransform, transform } from "./transform";
import { transformElement } from "./transforms/transformElement";
import { transformExpression } from "./transforms/transformExpression";
import { transformBind } from "./transforms/vBind";
import { transformIf } from "./transforms/vIf";
import { transformOn } from "./transforms/vOn";

export type TransformPreset = [NodeTransform[], Record<string, DirectiveTransform>];

export function getBaseTransformPreset(): TransformPreset {
  return [
    [transformIf, transformExpression, transformElement],
    { bind: transformBind, on: transformOn },
  ];
}

export function baseCompile(template: string, option: CompilerOptions) {
  const ast = baseParse(template.trim());

  const [nodeTransforms, directiveTransforms] = getBaseTransformPreset();

  transform(ast, {
    ...option,
    nodeTransforms: [...nodeTransforms],
    directiveTransforms: {
      ...directiveTransforms,
      ...option.directiveTransforms,
    },
  });

  const code = generate(ast, option);
  return code;
}
