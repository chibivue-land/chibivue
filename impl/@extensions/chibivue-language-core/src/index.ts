// Language Plugin
export { createChibivueLanguagePlugin } from "./languagePlugin";

// Virtual Code
export { ChibivueVirtualCode } from "./virtualCode";

// SFC Parser
export { parseSfc } from "./parseSfc";

// Types
export type {
  SfcBlock,
  SfcDescriptor,
  ChibivueCodeInformation,
  ChibivueCompilerOptions,
  CodeSegment,
} from "./types";
export { codeFeatures } from "./types";
