import type { SFCTemplateCompileResults } from "@chibivue/compiler-sfc";
import type { ResolvedOptions } from ".";

export interface TemplateOptions {
  id?: string;
  scoped?: boolean;
}

export function transformTemplateInMain(
  code: string,
  options: ResolvedOptions,
  templateOptions?: TemplateOptions,
): SFCTemplateCompileResults {
  const result = compile(code, options, templateOptions);
  return {
    ...result,
    code: result.code.replace(/\n(function|const) (render|ssrRender)/, "\n$1 _sfc_$2"),
  };
}

export function compile(
  source: string,
  options: ResolvedOptions,
  templateOptions?: TemplateOptions,
): SFCTemplateCompileResults {
  return options.compiler.compileTemplate({
    source,
    id: templateOptions?.id,
    scoped: templateOptions?.scoped,
  });
}
