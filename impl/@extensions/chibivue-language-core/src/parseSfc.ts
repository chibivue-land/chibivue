import type { SfcBlock, SfcDescriptor } from "./types";

// ============================================================================
// Simple SFC Parser
// ============================================================================

/**
 * Parse a .vue SFC file into its constituent blocks
 * This is a minimal implementation for language tools
 */
export function parseSfc(content: string, fileName: string): SfcDescriptor {
  const descriptor: SfcDescriptor = {
    template: null,
    script: null,
    scriptSetup: null,
    styles: [],
    customBlocks: [],
  };

  // Match all top-level blocks
  const blockRegex = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(content)) !== null) {
    const [fullMatch, tagName, attrsString, blockContent] = match;
    const startOffset = match.index;
    const endOffset = startOffset + fullMatch.length;

    // Parse attributes
    const attrs = parseAttributes(attrsString);

    // Calculate line/column positions
    const startPos = offsetToPosition(content, startOffset);
    const endPos = offsetToPosition(content, endOffset);

    // Calculate content offset (after opening tag)
    const openingTagLength = `<${tagName}${attrsString}>`.length;
    const contentStartOffset = startOffset + openingTagLength;
    const contentStartPos = offsetToPosition(content, contentStartOffset);
    const contentEndOffset = endOffset - `</${tagName}>`.length;
    const contentEndPos = offsetToPosition(content, contentEndOffset);

    const block: SfcBlock = {
      type: tagName,
      content: blockContent,
      loc: {
        start: contentStartPos,
        end: contentEndPos,
      },
      attrs,
      lang: typeof attrs.lang === "string" ? attrs.lang : undefined,
    };

    // Categorize block
    switch (tagName) {
      case "template":
        descriptor.template = block;
        break;
      case "script":
        if ("setup" in attrs) {
          descriptor.scriptSetup = block;
        } else {
          descriptor.script = block;
        }
        break;
      case "style":
        descriptor.styles.push(block);
        break;
      default:
        descriptor.customBlocks.push(block);
        break;
    }
  }

  return descriptor;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse HTML-like attributes from a string
 */
function parseAttributes(attrsString: string): Record<string, string | true> {
  const attrs: Record<string, string | true> = {};
  const attrRegex = /(\w+)(?:=["']([^"']*)["'])?/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(attrsString)) !== null) {
    const [, name, value] = match;
    attrs[name] = value ?? true;
  }

  return attrs;
}

/**
 * Convert byte offset to line/column position
 */
function offsetToPosition(
  content: string,
  offset: number,
): { line: number; column: number; offset: number } {
  let line = 1;
  let column = 1;

  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return { line, column, offset };
}
