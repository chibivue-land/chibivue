export * from "./parse";
export { compileScript } from "./compileScript";
export { compileStyle } from "./compileStyle";
export { compileTemplate } from "./compileTemplate";
export { rewriteDefault } from "./rewriteDefault";

export type { SFCStyleCompileOptions, SFCStyleCompileResults } from "./compileStyle";

export type {
  SFCTemplateCompileResults,
  SFCTemplateCompileOptions,
  TemplateCompiler,
} from "./compileTemplate";
