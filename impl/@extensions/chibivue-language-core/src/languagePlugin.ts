import type { CodegenContext, LanguagePlugin, VirtualCode } from "@volar/language-core";
import type {} from "@volar/typescript"; // Module augmentation for typescript property
import { ChibivueVirtualCode } from "./virtualCode";
import type { ChibivueCompilerOptions } from "./types";

// ============================================================================
// Chibivue Language Plugin
// ============================================================================

/**
 * Create a Volar.js language plugin for chibivue SFC files
 */
export function createChibivueLanguagePlugin(
  _options: ChibivueCompilerOptions = {},
): LanguagePlugin<string, ChibivueVirtualCode> {
  return {
    /**
     * Get language ID for a file
     */
    getLanguageId(scriptId: string): string | undefined {
      if (scriptId.endsWith(".vue")) {
        return "vue";
      }
      return undefined;
    },

    /**
     * Create virtual code for a .vue file
     */
    createVirtualCode(
      scriptId: string,
      languageId: string,
      snapshot: ts.IScriptSnapshot,
      _ctx: CodegenContext<string>,
    ): ChibivueVirtualCode | undefined {
      if (languageId === "vue") {
        return new ChibivueVirtualCode(scriptId, snapshot);
      }
      return undefined;
    },

    /**
     * Update existing virtual code
     */
    updateVirtualCode(
      _scriptId: string,
      virtualCode: ChibivueVirtualCode,
      snapshot: ts.IScriptSnapshot,
      _ctx: CodegenContext<string>,
    ): ChibivueVirtualCode {
      virtualCode.update(snapshot);
      return virtualCode;
    },

    /**
     * TypeScript integration
     */
    typescript: {
      extraFileExtensions: [
        {
          extension: "vue",
          isMixedContent: true,
          scriptKind: 7, // ts.ScriptKind.Deferred
        },
      ],

      getServiceScript(rootVirtualCode: ChibivueVirtualCode) {
        // Find the TypeScript embedded code
        for (const code of rootVirtualCode.embeddedCodes ?? []) {
          if (code.id === "ts") {
            return {
              code,
              extension: ".ts" as const,
              scriptKind: 3, // ts.ScriptKind.TS
            };
          }
        }
        return undefined;
      },
    },
  };
}

// TypeScript types
declare namespace ts {
  interface IScriptSnapshot {
    getText(start: number, end: number): string;
    getLength(): number;
    getChangeRange(
      oldSnapshot: IScriptSnapshot,
    ): { span: { start: number; length: number }; newLength: number } | undefined;
  }
}
