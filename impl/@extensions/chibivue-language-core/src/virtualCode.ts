import type { VirtualCode, CodeMapping, Mapping } from "@volar/language-core";
import { parseSfc } from "./parseSfc";
import type { SfcDescriptor, ChibivueCodeInformation, CodeSegment } from "./types";
import { codeFeatures } from "./types";

// ============================================================================
// Chibivue Virtual Code
// ============================================================================

/**
 * Virtual code representation for a .vue file
 * Implements Volar.js VirtualCode interface
 */
export class ChibivueVirtualCode implements VirtualCode {
  id = "root";
  languageId = "typescript";
  snapshot: ts.IScriptSnapshot;
  mappings: CodeMapping[] = [];
  embeddedCodes: VirtualCode[] = [];

  private sfc: SfcDescriptor;
  private fileName: string;

  constructor(fileName: string, snapshot: ts.IScriptSnapshot) {
    this.fileName = fileName;
    this.snapshot = snapshot;
    const content = snapshot.getText(0, snapshot.getLength());
    this.sfc = parseSfc(content, fileName);
    this.generateVirtualCode();
  }

  /**
   * Update the virtual code when the source changes
   */
  update(snapshot: ts.IScriptSnapshot): void {
    this.snapshot = snapshot;
    const content = snapshot.getText(0, snapshot.getLength());
    this.sfc = parseSfc(content, this.fileName);
    this.generateVirtualCode();
  }

  /**
   * Generate virtual TypeScript code from SFC
   */
  private generateVirtualCode(): void {
    const segments: CodeSegment[] = [];
    const sourceContent = this.snapshot.getText(0, this.snapshot.getLength());

    // Generate script/scriptSetup code
    this.generateScriptCode(segments);

    // Generate template type-checking code
    this.generateTemplateCode(segments);

    // Build final code and mappings
    const { code, mappings } = this.buildCode(segments, sourceContent);

    // Create embedded code for the generated TypeScript
    this.embeddedCodes = [
      {
        id: "ts",
        languageId: "typescript",
        snapshot: {
          getText: (start, end) => code.slice(start, end),
          getLength: () => code.length,
          getChangeRange: () => undefined,
        },
        mappings,
        embeddedCodes: [],
      },
    ];

    // Root mappings (map entire file)
    this.mappings = [
      {
        sourceOffsets: [0],
        generatedOffsets: [0],
        lengths: [sourceContent.length],
        data: codeFeatures.all,
      },
    ];
  }

  /**
   * Generate TypeScript code from script/scriptSetup blocks
   */
  private generateScriptCode(segments: CodeSegment[]): void {
    const { script, scriptSetup } = this.sfc;

    // Import chibivue types
    segments.push(`import { defineComponent, ref, computed, reactive } from "chibivue";\n\n`);

    // Script setup block
    if (scriptSetup) {
      const lang = scriptSetup.lang || "ts";
      segments.push(`// <script setup>\n`);

      // Map the script setup content
      segments.push([
        scriptSetup.content,
        "scriptSetup",
        scriptSetup.loc.start.offset,
        codeFeatures.all,
      ]);

      segments.push(`\n// </script setup>\n\n`);
    }

    // Regular script block
    if (script) {
      segments.push(`// <script>\n`);

      segments.push([script.content, "script", script.loc.start.offset, codeFeatures.all]);

      segments.push(`\n// </script>\n\n`);
    }

    // Default export if no script
    if (!script && !scriptSetup) {
      segments.push(`export default defineComponent({});\n\n`);
    }
  }

  /**
   * Generate TypeScript code for template type-checking
   */
  private generateTemplateCode(segments: CodeSegment[]): void {
    const { template } = this.sfc;

    if (!template) return;

    segments.push(`// Template type-checking\n`);
    segments.push(`declare const __VLS_template: () => void;\n`);

    // Extract and type-check interpolations {{ ... }}
    const interpolationRegex = /\{\{\s*([\s\S]*?)\s*\}\}/g;
    let match: RegExpExecArray | null;
    let index = 0;

    while ((match = interpolationRegex.exec(template.content)) !== null) {
      const expression = match[1];
      const expressionOffset =
        template.loc.start.offset + match.index + match[0].indexOf(expression);

      segments.push(`// Interpolation ${index}\n`);
      segments.push(`(() => {\n  const __expr${index} = (`);

      // Map the expression back to template
      segments.push([expression, "template", expressionOffset, codeFeatures.all]);

      segments.push(`);\n})();\n`);
      index++;
    }

    segments.push(`\n`);
  }

  /**
   * Build final code string and mappings from segments
   */
  private buildCode(
    segments: CodeSegment[],
    sourceContent: string,
  ): { code: string; mappings: CodeMapping[] } {
    let code = "";
    const mappings: CodeMapping[] = [];

    for (const segment of segments) {
      if (typeof segment === "string") {
        code += segment;
      } else {
        const [content, sourceId, sourceOffset, codeInfo] = segment;
        const generatedOffset = code.length;

        // Add mapping
        mappings.push({
          sourceOffsets: [sourceOffset],
          generatedOffsets: [generatedOffset],
          lengths: [content.length],
          data: codeInfo,
        });

        code += content;
      }
    }

    return { code, mappings };
  }
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
