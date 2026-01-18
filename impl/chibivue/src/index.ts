import { type RenderFunction, registerRuntimeCompiler } from "@chibivue/runtime-core";
import * as runtimeDom from "@chibivue/runtime-dom";

import type { CompilerOptions } from "@chibivue/compiler-core";
import { compile } from "@chibivue/compiler-dom";

function compileToFunction(template: string, options?: CompilerOptions): RenderFunction {
  const opts = { ...options, isBrowser: true } as CompilerOptions;
  const { code } = compile(template, opts);
  return new Function("ChibiVue", code)(runtimeDom);
}

registerRuntimeCompiler(compileToFunction);

export * from "@chibivue/runtime-dom";
export * from "@chibivue/runtime-core";
