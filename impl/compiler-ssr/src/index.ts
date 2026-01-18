import {
  type CodegenResult,
  type CompilerOptions,
  type RootNode,
  baseParse,
  generate,
  transform,
  transformBind,
  transformExpression,
} from "@chibivue/compiler-core";
import { parserOptions } from "@chibivue/compiler-dom";
import { ssrCodegenTransform } from "./ssrCodegenTransform";
import { ssrTransformElement } from "./transforms/ssrTransformElement";
import { ssrTransformComponent } from "./transforms/ssrTransformComponent";
import { ssrTransformIf } from "./transforms/ssrVIf";
import { ssrTransformFor } from "./transforms/ssrVFor";

export function compile(source: string | RootNode, options: CompilerOptions = {}): CodegenResult {
  options = {
    ...options,
    ...parserOptions,
    ssr: true,
    // always prefix since compiler-ssr doesn't have size concern
    prefixIdentifiers: true,
    // disable optimizations that are unnecessary for ssr
    hoistStatic: false,
  };

  const ast = typeof source === "string" ? baseParse(source, options) : source;

  transform(ast, {
    ...options,
    hoistStatic: false,
    nodeTransforms: [
      ssrTransformIf,
      ssrTransformFor,
      transformExpression,
      ssrTransformElement,
      ssrTransformComponent,
      ...(options.nodeTransforms || []),
    ],
    directiveTransforms: {
      bind: transformBind,
      ...(options.directiveTransforms || {}),
    },
  });

  // traverse the template AST and convert into SSR codegen AST
  // by replacing ast.codegenNode.
  ssrCodegenTransform(ast, options);

  return generate(ast, options);
}

export { ssrCodegenTransform } from "./ssrCodegenTransform";
export * from "./runtimeHelpers";
export { parse } from "@chibivue/compiler-dom";
