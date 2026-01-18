import type { SFCStyleBlock } from "./parse";

export interface SFCStyleCompileOptions {
  source: string;
  id: string;
  scoped?: boolean;
}

export interface SFCStyleCompileResult {
  code: string;
}

export function compileStyle(options: SFCStyleCompileOptions): SFCStyleCompileResult {
  const { source, id, scoped } = options;

  if (!scoped) {
    return { code: source };
  }

  // Apply scoped transformation
  const scopedCode = applyScopedCss(source, id);

  return { code: scopedCode };
}

function applyScopedCss(css: string, scopeId: string): string {
  // Simple scoped CSS implementation
  // Add the scope attribute selector to each rule
  const scopeAttr = `[data-v-${scopeId}]`;

  // Match CSS rule selectors (simplified)
  // This handles basic cases like .class, #id, element, etc.
  return css.replace(/([^\{\}]+)\{/g, (match, selectors: string) => {
    const scopedSelectors = selectors
      .split(",")
      .map((sel: string) => {
        sel = sel.trim();
        if (!sel) return sel;

        // Handle :deep() pseudo-selector
        if (sel.includes(":deep(")) {
          return sel.replace(/:deep\(([^)]+)\)/g, `${scopeAttr} $1`);
        }

        // Handle :global() pseudo-selector
        if (sel.includes(":global(")) {
          return sel.replace(/:global\(([^)]+)\)/g, "$1");
        }

        // Handle :slotted() pseudo-selector
        if (sel.includes(":slotted(")) {
          return sel.replace(/:slotted\(([^)]+)\)/g, `${scopeAttr} $1`);
        }

        // Add scope to regular selectors
        // For compound selectors, add scope to the last element
        const parts = sel.split(/\s+/);
        if (parts.length > 0) {
          const lastPart = parts[parts.length - 1];
          // Handle pseudo-elements and pseudo-classes
          if (lastPart.includes("::") || lastPart.match(/:[a-z-]+$/)) {
            const [base, ...rest] = lastPart.split(/(::?[a-z-]+.*)/);
            parts[parts.length - 1] = base + scopeAttr + rest.join("");
          } else {
            parts[parts.length - 1] = lastPart + scopeAttr;
          }
        }
        return parts.join(" ");
      })
      .join(", ");

    return scopedSelectors + " {";
  });
}

export function generateScopeId(filename: string): string {
  // Simple hash function for generating scope ID
  let hash = 0;
  for (let i = 0; i < filename.length; i++) {
    const char = filename.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}
