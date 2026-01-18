import { parse as babelParse } from "@babel/parser";
import type {
  Statement,
  VariableDeclaration,
  FunctionDeclaration,
  Identifier,
  CallExpression,
  ObjectExpression,
  ArrayExpression,
} from "@babel/types";
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

export function compileScript(
  sfc: SFCDescriptor,
): SFCScriptCompileResult {
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
  let propsDecl: string | null = null;
  let propsRuntimeDecl: string | null = null;
  const propNames: string[] = [];

  for (const node of ast.program.body) {
    if (node.type === "ImportDeclaration") {
      // Keep import statements (but filter out defineProps import)
      const filteredSpecifiers = node.specifiers.filter((spec) => {
        if (spec.type === "ImportSpecifier" && spec.imported.type === "Identifier") {
          return spec.imported.name !== "defineProps";
        }
        return true;
      });
      if (filteredSpecifiers.length > 0) {
        imports.push(scriptSetup.content.slice(node.start!, node.end!));
      }
      // Track imported bindings
      for (const spec of node.specifiers) {
        const name = spec.local.name;
        bindings[name] = BindingTypes.SETUP_MAYBE_REF;
      }
    } else if (node.type === "VariableDeclaration") {
      // Check for defineProps call
      const decl = node.declarations[0];
      if (
        decl &&
        decl.init &&
        decl.init.type === "CallExpression" &&
        decl.init.callee.type === "Identifier" &&
        decl.init.callee.name === "defineProps"
      ) {
        // Handle defineProps
        if (decl.id.type === "Identifier") {
          propsDecl = decl.id.name;
          bindings[propsDecl] = BindingTypes.SETUP_CONST;
        }
        // Extract runtime props declaration
        const arg = decl.init.arguments[0];
        if (arg) {
          if (arg.type === "ArrayExpression") {
            // Array syntax: defineProps(['foo', 'bar'])
            for (const el of arg.elements) {
              if (el && el.type === "StringLiteral") {
                propNames.push(el.value);
                bindings[el.value] = BindingTypes.PROPS;
              }
            }
            propsRuntimeDecl = scriptSetup.content.slice(arg.start!, arg.end!);
          } else if (arg.type === "ObjectExpression") {
            // Object syntax: defineProps({ foo: String, bar: Number })
            for (const prop of arg.properties) {
              if (prop.type === "ObjectProperty" && prop.key.type === "Identifier") {
                propNames.push(prop.key.name);
                bindings[prop.key.name] = BindingTypes.PROPS;
              }
            }
            propsRuntimeDecl = scriptSetup.content.slice(arg.start!, arg.end!);
          }
        }
        continue; // Don't add to statements
      }

      // Track variable declarations
      statements.push(scriptSetup.content.slice(node.start!, node.end!));
      for (const d of node.declarations) {
        if (d.id.type === "Identifier") {
          const name = d.id.name;
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
    } else if (node.type === "ExpressionStatement") {
      // Check for standalone defineProps call
      if (
        node.expression.type === "CallExpression" &&
        node.expression.callee.type === "Identifier" &&
        node.expression.callee.name === "defineProps"
      ) {
        const arg = node.expression.arguments[0];
        if (arg) {
          if (arg.type === "ArrayExpression") {
            for (const el of arg.elements) {
              if (el && el.type === "StringLiteral") {
                propNames.push(el.value);
                bindings[el.value] = BindingTypes.PROPS;
              }
            }
            propsRuntimeDecl = scriptSetup.content.slice(arg.start!, arg.end!);
          } else if (arg.type === "ObjectExpression") {
            for (const prop of arg.properties) {
              if (prop.type === "ObjectProperty" && prop.key.type === "Identifier") {
                propNames.push(prop.key.name);
                bindings[prop.key.name] = BindingTypes.PROPS;
              }
            }
            propsRuntimeDecl = scriptSetup.content.slice(arg.start!, arg.end!);
          }
        }
        continue; // Don't add to statements
      }
      statements.push(scriptSetup.content.slice(node.start!, node.end!));
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

  // Add props if defined
  if (propsRuntimeDecl) {
    code += `  props: ${propsRuntimeDecl},\n`;
  }

  code += "  setup(__props) {\n";

  // Add props destructure if we have a props variable
  if (propsDecl) {
    code += `    const ${propsDecl} = __props\n`;
  }

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
