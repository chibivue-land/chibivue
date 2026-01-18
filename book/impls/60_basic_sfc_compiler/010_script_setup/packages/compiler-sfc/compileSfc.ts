import { compileScript } from "./compileScript";
import { parse } from "./parse";
import * as CompilerDOM from "../compiler-dom";

export interface SFCCompileResult {
  code: string;
}

export function compileSfc(source: string, filename: string = "anonymous.vue"): SFCCompileResult {
  // Parse the SFC
  const { descriptor } = parse(source, { filename });

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

  // Add template as render function
  if (templateCode) {
    code += `\n\n${templateCode}`;
    code += `\n__sfc__.render = render`;
  }

  // Add styles (inline for now)
  if (descriptor.styles.length > 0) {
    const styles = descriptor.styles.map((s) => s.content).join("\n");
    code += `\n\n// Styles\nconst __style__ = \`${styles.replace(/`/g, "\\`")}\`;`;
    code += `\nif (typeof document !== 'undefined') {`;
    code += `\n  const __styleEl__ = document.createElement('style');`;
    code += `\n  __styleEl__.textContent = __style__;`;
    code += `\n  document.head.appendChild(__styleEl__);`;
    code += `\n}`;
  }

  return { code };
}
