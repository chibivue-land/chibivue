import type { ElementNode } from "./ast";
import type { TextModes } from "./parse";
import type { DirectiveTransform, NodeTransform } from "./transform";

export interface ParserOptions {
  isNativeTag?: (tag: string) => boolean;
  delimiters?: [string, string];
  decodeEntities?: (rawText: string, asAttr: boolean) => string;
  getTextMode?: (node: ElementNode, parent: ElementNode | undefined) => TextModes;
}

export interface TransformOptions extends SharedTransformCodegenOptions {
  nodeTransforms?: NodeTransform[];
  directiveTransforms?: Record<string, DirectiveTransform | undefined>;
  inline?: boolean;
  bindingMetadata?: BindingMetadata;
  hoistStatic?: boolean;
  prefixIdentifiers?: boolean;
}

export type BindingMetadata = {
  [key: string]: BindingTypes | undefined;
} & {
  __isScriptSetup?: boolean;
};

interface SharedTransformCodegenOptions {
  isBrowser?: boolean;
}

export const enum BindingTypes {
  DATA = "data",
  PROPS = "props",
  SETUP_CONST = "setup-const",
  SETUP_MAYBE_REF = "setup-maybe-ref",
  SETUP_REF = "setup-ref",
  SETUP_REACTIVE_CONST = "setup-reactive-const",
  SETUP_LET = "setup-let",
  LITERAL_CONST = "literal-const",
  OPTIONS = "options",
}

export interface CodegenOptions extends SharedTransformCodegenOptions {
  inline?: boolean;
  scopeId?: string;
}

export type CompilerOptions = ParserOptions & TransformOptions & CodegenOptions;
