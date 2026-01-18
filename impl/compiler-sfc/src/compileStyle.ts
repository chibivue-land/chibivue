export interface SFCStyleCompileOptions {
  source: string;
  filename: string;
  id: string;
  scoped?: boolean;
}

export interface SFCStyleCompileResults {
  code: string;
}

export function compileStyle(
  options: SFCStyleCompileOptions,
): SFCStyleCompileResults {
  const { source, id, scoped } = options;

  if (!scoped) {
    return { code: source };
  }

  const scopeId = `data-v-${id}`;
  const code = processScoped(source, scopeId);

  return { code };
}

/**
 * Process scoped CSS by adding scope attribute selector to each rule
 */
function processScoped(css: string, scopeId: string): string {
  // Simple CSS parser that handles basic cases
  // For production, you'd want to use PostCSS
  const result: string[] = [];
  let i = 0;

  while (i < css.length) {
    // Skip whitespace
    const wsStart = i;
    while (i < css.length && /\s/.test(css[i])) i++;
    if (i > wsStart) {
      result.push(css.slice(wsStart, i));
    }

    if (i >= css.length) break;

    // Check for comments
    if (css[i] === "/" && css[i + 1] === "*") {
      const commentEnd = css.indexOf("*/", i + 2);
      if (commentEnd === -1) {
        result.push(css.slice(i));
        break;
      }
      result.push(css.slice(i, commentEnd + 2));
      i = commentEnd + 2;
      continue;
    }

    // Check for at-rules
    if (css[i] === "@") {
      const atRule = parseAtRule(css, i);
      if (atRule.name === "media" || atRule.name === "supports") {
        // Process nested rules inside media/supports
        result.push(atRule.prelude);
        result.push("{");
        const nestedContent = processScoped(atRule.body, scopeId);
        result.push(nestedContent);
        result.push("}");
      } else if (atRule.name === "keyframes" || atRule.name === "-webkit-keyframes") {
        // Keep keyframes as-is
        result.push(css.slice(i, atRule.end));
      } else {
        // Other at-rules (like @import, @charset)
        result.push(css.slice(i, atRule.end));
      }
      i = atRule.end;
      continue;
    }

    // Parse selector and declaration block
    const ruleStart = i;
    const braceIndex = css.indexOf("{", i);
    if (braceIndex === -1) {
      result.push(css.slice(i));
      break;
    }

    const selector = css.slice(i, braceIndex).trim();
    i = braceIndex + 1;

    // Find matching closing brace
    let braceCount = 1;
    const bodyStart = i;
    while (i < css.length && braceCount > 0) {
      if (css[i] === "{") braceCount++;
      else if (css[i] === "}") braceCount--;
      i++;
    }
    const bodyEnd = i - 1;
    const body = css.slice(bodyStart, bodyEnd);

    // Transform selector
    const scopedSelector = transformSelector(selector, scopeId);
    result.push(scopedSelector);
    result.push(" {");
    result.push(body);
    result.push("}");
  }

  return result.join("");
}

interface AtRuleInfo {
  name: string;
  prelude: string;
  body: string;
  end: number;
}

function parseAtRule(css: string, start: number): AtRuleInfo {
  let i = start + 1; // Skip @

  // Get at-rule name
  const nameStart = i;
  while (i < css.length && /[a-zA-Z-]/.test(css[i])) i++;
  const name = css.slice(nameStart, i);

  // Get prelude (everything until { or ;)
  const preludeStart = start;
  while (i < css.length && css[i] !== "{" && css[i] !== ";") i++;

  if (css[i] === ";") {
    // At-rule without block (like @import)
    return {
      name,
      prelude: css.slice(preludeStart, i + 1),
      body: "",
      end: i + 1,
    };
  }

  const prelude = css.slice(preludeStart, i);
  i++; // Skip {

  // Find matching }
  let braceCount = 1;
  const bodyStart = i;
  while (i < css.length && braceCount > 0) {
    if (css[i] === "{") braceCount++;
    else if (css[i] === "}") braceCount--;
    i++;
  }

  const body = css.slice(bodyStart, i - 1);

  return { name, prelude, body, end: i };
}

/**
 * Transform a selector to add scope attribute
 */
function transformSelector(selector: string, scopeId: string): string {
  // Split by comma to handle multiple selectors
  return selector
    .split(",")
    .map((s) => transformSingleSelector(s.trim(), scopeId))
    .join(", ");
}

function transformSingleSelector(selector: string, scopeId: string): string {
  // Handle :deep() pseudo-class
  if (selector.includes(":deep(")) {
    return selector.replace(/:deep\(([^)]+)\)/g, (_, inner) => {
      // Add scope to the part before :deep, then the inner part without scope
      const parts = selector.split(/:deep\([^)]+\)/);
      const before = parts[0].trim();
      if (before) {
        return `${before}[${scopeId}] ${inner}`;
      }
      return `[${scopeId}] ${inner}`;
    });
  }

  // Handle :slotted() pseudo-class
  if (selector.includes(":slotted(")) {
    return selector.replace(/:slotted\(([^)]+)\)/g, (_, inner) => {
      return `${inner}[${scopeId}-s]`;
    });
  }

  // Handle :global() pseudo-class - remove the wrapper
  if (selector.includes(":global(")) {
    return selector.replace(/:global\(([^)]+)\)/g, "$1");
  }

  // Handle pseudo-elements and pseudo-classes
  // Add scope before pseudo-element/class
  const pseudoElementMatch = selector.match(/(::?[a-zA-Z-]+(?:\([^)]*\))?)$/);
  if (pseudoElementMatch) {
    const pseudoPart = pseudoElementMatch[1];
    const mainPart = selector.slice(0, -pseudoPart.length);
    return `${mainPart}[${scopeId}]${pseudoPart}`;
  }

  // Simple case: add [data-v-xxx] at the end
  return `${selector}[${scopeId}]`;
}
