import { baseParse } from "@chibivue/compiler-core";
import { parserOptions } from "@chibivue/compiler-dom";

import { generateVapor, type VaporCodegenOptions, type VaporCodegenResult } from "./codegen";

export interface VaporCompilerOptions extends VaporCodegenOptions {}

export function compile(template: string, options: VaporCompilerOptions = {}): VaporCodegenResult {
  const ast = baseParse(template, parserOptions);
  return generateVapor(ast, options);
}
