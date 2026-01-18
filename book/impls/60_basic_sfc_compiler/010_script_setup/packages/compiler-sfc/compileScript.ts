import { parse as babelParse } from "@babel/parser";
import type { Statement, VariableDeclaration, FunctionDeclaration, Identifier } from "@babel/types";
import { rewriteDefault } from "./rewriteDefault";
import type { SFCDescriptor, SFCScriptBlock } from "./parse";

export interface SFCScriptCompileResult {
  code: string;
  bindings?: Record<string, BindingTypes>;
}

export const enum BindingTypes {
  DATA = "data",
  PROPS = "props",
  SETUP_REF = "setup-ref",
  SETUP_CONST = "setup-const",
  SETUP_MAYBE_REF = "setup-maybe-ref",
  SETUP_LET = "setup-let",
  LITERAL_CONST = "literal-const",
  OPTIONS = "options",
}

export function compileScript(sfc: SFCDescriptor): SFCScriptCompileResult {
  const { script, scriptSetup } = sfc;

  // Handle script setup
  if (scriptSetup) {
    return compileScriptSetup(scriptSetup, script);
  }

  // Handle regular script
  if (!script) {
    return {
      code: "export default {}",
      bindings: {},
    };
  }

  let code = script.content;

  // Rewrite default export to __sfc__
  code = rewriteDefault(code, "__sfc__");

  // Add export statement
  code += "\nexport default __sfc__";

  return {
    code,
    bindings: {},
  };
}

function compileScriptSetup(
  scriptSetup: SFCScriptBlock,
  script: SFCScriptBlock | null,
): SFCScriptCompileResult {
  const bindings: Record<string, BindingTypes> = {};
  let code = "";

  // Parse the script setup content
  const ast = babelParse(scriptSetup.content, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  // Collect top-level bindings (variables, functions)
  const setupBindings: string[] = [];
  const imports: string[] = [];
  const statements: string[] = [];

  for (const node of ast.program.body) {
    if (node.type === "ImportDeclaration") {
      // Keep import statements
      imports.push(scriptSetup.content.slice(node.start!, node.end!));
      // Track imported bindings
      for (const spec of node.specifiers) {
        const name = spec.local.name;
        bindings[name] = BindingTypes.SETUP_MAYBE_REF;
      }
    } else if (node.type === "VariableDeclaration") {
      // Track variable declarations
      statements.push(scriptSetup.content.slice(node.start!, node.end!));
      for (const decl of node.declarations) {
        if (decl.id.type === "Identifier") {
          const name = decl.id.name;
          setupBindings.push(name);
          if (node.kind === "const") {
            bindings[name] = BindingTypes.SETUP_CONST;
          } else {
            bindings[name] = BindingTypes.SETUP_LET;
          }
        }
      }
    } else if (node.type === "FunctionDeclaration" && node.id) {
      // Track function declarations
      statements.push(scriptSetup.content.slice(node.start!, node.end!));
      const name = node.id.name;
      setupBindings.push(name);
      bindings[name] = BindingTypes.SETUP_CONST;
    } else {
      // Other statements
      statements.push(scriptSetup.content.slice(node.start!, node.end!));
    }
  }

  // Build the output code
  code = imports.join("\n");
  if (imports.length > 0) {
    code += "\n\n";
  }

  // Handle regular script if present
  if (script) {
    code += rewriteDefault(script.content, "__sfc_main__");
    code += "\n\n";
  }

  // Create the setup function
  code += "const __sfc__ = {\n";
  if (script) {
    code += "  ...__sfc_main__,\n";
  }
  code += "  setup() {\n";
  for (const stmt of statements) {
    code += "    " + stmt.split("\n").join("\n    ") + "\n";
  }
  code += "    return { ";
  code += setupBindings.join(", ");
  code += " }\n";
  code += "  }\n";
  code += "}\n\n";
  code += "export default __sfc__";

  return {
    code,
    bindings,
  };
}
