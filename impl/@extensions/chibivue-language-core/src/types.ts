import type { CodeInformation } from "@volar/language-core";

// ============================================================================
// SFC Block Types
// ============================================================================

export interface SfcBlock {
  type: string;
  content: string;
  loc: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };
  attrs: Record<string, string | true>;
  lang?: string;
}

export interface SfcDescriptor {
  template: SfcBlock | null;
  script: SfcBlock | null;
  scriptSetup: SfcBlock | null;
  styles: SfcBlock[];
  customBlocks: SfcBlock[];
}

// ============================================================================
// Code Information Types (for Volar.js)
// ============================================================================

export interface ChibivueCodeInformation extends CodeInformation {
  /** Enable diagnostic verification */
  verification?: boolean;
  /** Enable auto-completion */
  completion?: boolean;
  /** Enable semantic tokens (syntax highlighting) */
  semantic?: boolean;
  /** Enable navigation (go to definition, rename) */
  navigation?: boolean | { shouldRename?: () => boolean };
}

// ============================================================================
// Compiler Options
// ============================================================================

export interface ChibivueCompilerOptions {
  /** Target chibivue version */
  target?: 3;
  /** Check unknown props */
  checkUnknownProps?: boolean;
  /** Check unknown events */
  checkUnknownEvents?: boolean;
}

// ============================================================================
// Code Segment Types
// ============================================================================

/**
 * Code segment with source mapping information
 * [content, sourceId, sourceOffset, codeInfo]
 */
export type CodeSegment =
  | string
  | [content: string, sourceId: string, sourceOffset: number, codeInfo: ChibivueCodeInformation];

// ============================================================================
// Code Features (what IDE features to enable for code ranges)
// ============================================================================

export const codeFeatures = {
  all: {
    verification: true,
    completion: true,
    semantic: true,
    navigation: true,
  } satisfies ChibivueCodeInformation,

  verification: {
    verification: true,
  } satisfies ChibivueCodeInformation,

  completion: {
    completion: true,
  } satisfies ChibivueCodeInformation,

  navigation: {
    navigation: true,
  } satisfies ChibivueCodeInformation,

  navigationWithoutRename: {
    navigation: {
      shouldRename: () => false,
    },
  } satisfies ChibivueCodeInformation,
};
