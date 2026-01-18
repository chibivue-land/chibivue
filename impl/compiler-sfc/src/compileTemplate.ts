import type {
  CodegenResult,
  CompilerOptions,
  ParserOptions,
  RootNode,
} from "@chibivue/compiler-core";
import * as CompilerDOM from "@chibivue/compiler-dom";
import * as CompilerSSR from "@chibivue/compiler-ssr";

export interface TemplateCompiler {
  compile(template: string, options: CompilerOptions): CodegenResult;
  parse(template: string, options: ParserOptions): RootNode;
}

export interface SFCTemplateCompileResults {
  code: string;
  source: string;
  ast?: RootNode;
  preamble?: string;
}

export interface SFCTemplateCompileOptions {
  source: string;
  compiler?: TemplateCompiler;
  compilerOptions?: CompilerOptions;
  id?: string;
  scoped?: boolean;
  ssr?: boolean;
}

export function compileTemplate({
  source,
  compiler,
  compilerOptions,
  id,
  scoped,
  ssr = false,
}: SFCTemplateCompileOptions): SFCTemplateCompileResults {
  const defaultCompiler = ssr
    ? (CompilerSSR as TemplateCompiler)
    : CompilerDOM;

  let { code, ast, preamble } = (compiler || defaultCompiler).compile(source, {
    ...compilerOptions,
    isBrowser: false,
    scopeId: scoped ? id : undefined,
    ssr,
  });
  return { code: code, ast, source, preamble };
}
