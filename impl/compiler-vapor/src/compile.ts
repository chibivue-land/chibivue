import { baseParse } from "@chibivue/compiler-core";
import { parserOptions } from "@chibivue/compiler-dom";

import {
  generateVapor,
  generateVaporFromIR,
  type VaporCodegenOptions,
  type VaporCodegenResult,
} from "./codegen";
import { transform } from "./transform";

export interface VaporCompilerOptions extends VaporCodegenOptions {
  /**
   * Use the new IR-based compilation pipeline.
   * When true, uses: parse -> transform (IR) -> codegen
   * When false, uses: parse -> codegen (legacy direct AST analysis)
   */
  useIR?: boolean;
}

/**
 * Compile a template string to Vapor render function code.
 *
 * Compilation Pipeline:
 * 1. Parse: template string -> AST (Abstract Syntax Tree)
 * 2. Transform: AST -> IR (Intermediate Representation)
 * 3. Codegen: IR -> JavaScript code
 *
 * The IR stage is crucial for optimization and allows:
 * - Separation of concerns between parsing and code generation
 * - Static analysis and optimization passes
 * - Easier maintenance and extensibility
 */
export function compile(template: string, options: VaporCompilerOptions = {}): VaporCodegenResult {
  const ast = baseParse(template, parserOptions);

  if (options.useIR) {
    // New IR-based pipeline: AST -> IR -> Code
    const ir = transform(ast, template);
    return generateVaporFromIR(ir, options);
  }

  // Legacy pipeline: AST -> Code (direct analysis)
  return generateVapor(ast, options);
}

// Re-export transform for advanced use cases
export { transform } from "./transform";
