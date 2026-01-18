import type { SFCStyleBlock } from "./parse";

export interface SFCStyleCompileOptions {
  source: string;
  id: string;
  scoped?: boolean;
}

export interface SFCStyleCompileResult {
  code: string;
  /** CSS variable names extracted from v-bind() expressions */
  cssVars?: string[];
}

export function compileStyle(options: SFCStyleCompileOptions): SFCStyleCompileResult {
  const { source, id, scoped } = options;

  // First, process v-bind() expressions
  const { code: processedCss, cssVars } = processVBind(source, id);

  if (!scoped) {
    return { code: processedCss, cssVars };
  }

  // Apply scoped transformation
  const scopedCode = applyScopedCss(processedCss, id);

  return { code: scopedCode, cssVars };
}

/**
 * Process v-bind() expressions in CSS
 *
 * Converts v-bind(expr) to var(--{id}-{expr})
 *
 * NOTE: v-bind() in CSS has performance implications:
 * - Each v-bind() creates a CSS custom property that is set via inline style
 * - The values are updated reactively when the expression changes
 * - This triggers style recalculation on every update
 * - For frequently changing values, consider using inline styles instead
 */
function processVBind(css: string, id: string): { code: string; cssVars: string[] } {
  const cssVars: string[] = [];
  const vBindRE = /v-bind\s*\(\s*([^)]+)\s*\)/g;

  const code = css.replace(vBindRE, (match, expr: string) => {
    // Normalize the expression (remove quotes if present)
    let varName = expr.trim();
    if ((varName.startsWith("'") && varName.endsWith("'")) ||
        (varName.startsWith('"') && varName.endsWith('"'))) {
      varName = varName.slice(1, -1);
    }

    // Escape special characters for CSS variable names
    const escapedVarName = escapeCssVarName(varName);

    if (!cssVars.includes(varName)) {
      cssVars.push(varName);
    }

    return `var(--${id}-${escapedVarName})`;
  });

  return { code, cssVars };
}

/**
 * Escape special characters in CSS variable names
 * CSS variable names cannot contain spaces or most special characters
 */
function escapeCssVarName(name: string): string {
  // Replace dots with escaped version, handle other special chars
  return name
    .replace(/\./g, "\\.")
    .replace(/\s+/g, "_");
}

function applyScopedCss(css: string, scopeId: string): string {
  // Simple scoped CSS implementation
  // Add the scope attribute selector to each rule
  const scopeAttr = `[data-v-${scopeId}]`;
  const slottedScopeAttr = `[data-v-${scopeId}-s]`;

  // Match CSS rule selectors (simplified)
  // This handles basic cases like .class, #id, element, etc.
  return css.replace(
    /([^\{\}]+)\{/g,
    (match, selectors: string) => {
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

          // Handle :slotted() and ::v-slotted() pseudo-selector
          // ::v-slotted(.foo) -> .foo[data-v-xxx-s]
          // The -s suffix indicates this is a slotted content selector
          if (sel.includes(":slotted(") || sel.includes("::v-slotted(")) {
            // Extract parts before the slotted selector
            const slottedMatch = sel.match(/^(.*)(?::slotted|::v-slotted)\(([^)]+)\)(.*)$/);
            if (slottedMatch) {
              const [, prefix, innerSelector, suffix] = slottedMatch;
              // Add the slotted scope attribute to the inner selector's last element
              const innerParts = innerSelector.trim().split(/\s+/);
              if (innerParts.length > 0) {
                innerParts[innerParts.length - 1] += slottedScopeAttr;
              }
              // Combine: prefix (if any) + scoped inner selector + suffix (if any)
              const result = [prefix?.trim(), innerParts.join(" "), suffix?.trim()]
                .filter(Boolean)
                .join(" ");
              return result;
            }
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
    }
  );
}

export function generateScopeId(filename: string): string {
  // Simple hash function for generating scope ID
  let hash = 0;
  for (let i = 0; i < filename.length; i++) {
    const char = filename.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}
