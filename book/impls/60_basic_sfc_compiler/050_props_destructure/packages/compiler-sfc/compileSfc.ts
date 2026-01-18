import { compileScript } from "./compileScript";
import { compileStyle, generateScopeId } from "./compileStyle";
import { parse } from "./parse";
import * as CompilerDOM from "../compiler-dom";

export interface SFCCompileResult {
  code: string;
  scopeId?: string;
}

export function compileSfc(
  source: string,
  filename: string = "anonymous.vue",
): SFCCompileResult {
  // Parse the SFC
  const { descriptor } = parse(source, { filename });

  // Generate scope ID if we have scoped styles
  const hasScoped = descriptor.styles.some((s) => s.scoped);
  const scopeId = hasScoped ? generateScopeId(filename) : undefined;

  // Compile script
  const scriptResult = compileScript(descriptor);

  // Compile template
  let templateCode = "";
  if (descriptor.template) {
    const templateContent = descriptor.template.content;
    const compiledTemplate = CompilerDOM.compile(templateContent);
    templateCode = compiledTemplate;
  }

  // Generate final code
  let code = "";

  // Add script code
  code += scriptResult.code;

  // Add __scopeId if scoped
  if (scopeId) {
    code += `\n__sfc__.__scopeId = "data-v-${scopeId}"`;
  }

  // Add template as render function
  if (templateCode) {
    code += `\n\n${templateCode}`;
    code += `\n__sfc__.render = render`;
  }

  // Add styles (with scoped transformation if needed)
  if (descriptor.styles.length > 0) {
    const compiledStyles = descriptor.styles.map((styleBlock) => {
      const result = compileStyle({
        source: styleBlock.content,
        id: scopeId || "",
        scoped: styleBlock.scoped,
      });
      return result.code;
    });

    const styles = compiledStyles.join("\n");
    code += `\n\n// Styles\nconst __style__ = \`${styles.replace(/`/g, "\\`")}\`;`;
    code += `\nif (typeof document !== 'undefined') {`;
    code += `\n  const __styleEl__ = document.createElement('style');`;
    code += `\n  __styleEl__.textContent = __style__;`;
    code += `\n  document.head.appendChild(__styleEl__);`;
    code += `\n}`;
  }

  return { code, scopeId };
}
