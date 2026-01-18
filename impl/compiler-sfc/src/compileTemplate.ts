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
  /**
   * Enable Vapor mode compilation.
   * When combined with ssr: true, uses compiler-ssr with __vapor flag.
   */
  vapor?: boolean;
}

export function compileTemplate({
  source,
  compiler,
  compilerOptions,
  id,
  scoped,
  ssr = false,
  vapor = false,
}: SFCTemplateCompileOptions): SFCTemplateCompileResults {
  // Determine the compiler to use:
  // - Vapor + SSR: Use compiler-ssr (generates VNode SSR code)
  // - SSR only: Use compiler-ssr
  // - Vapor only: Use compiler-dom (vapor compilation is handled separately)
  // - Default: Use compiler-dom
  //
  // Note: In Vapor SSR mode, the server-side rendering uses standard VNode SSR.
  // The __vapor flag is used to indicate that hydration should use Vapor mode.
  const defaultCompiler = ssr
    ? (CompilerSSR as TemplateCompiler)
    : CompilerDOM;

  let { code, ast, preamble } = (compiler || defaultCompiler).compile(source, {
    ...compilerOptions,
    isBrowser: false,
    scopeId: scoped ? id : undefined,
    ssr,
  });

  // For Vapor + SSR mode, the rendered code needs to indicate it's a Vapor component
  // This flag is used during hydration to use Vapor-specific hydration logic
  if (vapor && ssr) {
    // Add __vapor marker to the component definition for hydration
    // The hydration logic will detect this and use createVaporSSRApp
    code = code.replace(
      /export (function|const) ssrRender/,
      "export const __vapor = true;\nexport $1 ssrRender",
    );
  }

  return { code: code, ast, source, preamble };
}
