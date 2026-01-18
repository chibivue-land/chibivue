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

const DEFINE_PROPS = "defineProps";
const DEFINE_EMITS = "defineEmits";

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
  let emitsDecl: string | null = null;
  let emitsRuntimeDecl: string | null = null;
  const propNames: string[] = [];
  const emitNames: string[] = [];

  for (const node of ast.program.body) {
    if (node.type === "ImportDeclaration") {
      // Keep import statements (but filter out compiler macros)
      const filteredSpecifiers = node.specifiers.filter((spec) => {
        if (spec.type === "ImportSpecifier" && spec.imported.type === "Identifier") {
          return ![DEFINE_PROPS, DEFINE_EMITS].includes(spec.imported.name);
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
      const decl = node.declarations[0];
      if (decl && decl.init && decl.init.type === "CallExpression" && decl.init.callee.type === "Identifier") {
        const calleeName = decl.init.callee.name;

        // Check for defineProps call
        if (calleeName === DEFINE_PROPS) {
          if (decl.id.type === "Identifier") {
            propsDecl = decl.id.name;
            bindings[propsDecl] = BindingTypes.SETUP_CONST;
          }
          const arg = decl.init.arguments[0];
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
          continue;
        }

        // Check for defineEmits call
        if (calleeName === DEFINE_EMITS) {
          if (decl.id.type === "Identifier") {
            emitsDecl = decl.id.name;
            bindings[emitsDecl] = BindingTypes.SETUP_CONST;
            setupBindings.push(emitsDecl);
          }
          const arg = decl.init.arguments[0];
          if (arg) {
            if (arg.type === "ArrayExpression") {
              for (const el of arg.elements) {
                if (el && el.type === "StringLiteral") {
                  emitNames.push(el.value);
                }
              }
              emitsRuntimeDecl = scriptSetup.content.slice(arg.start!, arg.end!);
            } else if (arg.type === "ObjectExpression") {
              for (const prop of arg.properties) {
                if (prop.type === "ObjectProperty" && prop.key.type === "Identifier") {
                  emitNames.push(prop.key.name);
                }
              }
              emitsRuntimeDecl = scriptSetup.content.slice(arg.start!, arg.end!);
            }
          }
          continue;
        }
      }

      // Track regular variable declarations
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
      statements.push(scriptSetup.content.slice(node.start!, node.end!));
      const name = node.id.name;
      setupBindings.push(name);
      bindings[name] = BindingTypes.SETUP_CONST;
    } else if (node.type === "ExpressionStatement") {
      // Check for standalone defineProps/defineEmits call
      if (
        node.expression.type === "CallExpression" &&
        node.expression.callee.type === "Identifier"
      ) {
        const calleeName = node.expression.callee.name;

        if (calleeName === DEFINE_PROPS) {
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
          continue;
        }

        if (calleeName === DEFINE_EMITS) {
          const arg = node.expression.arguments[0];
          if (arg) {
            if (arg.type === "ArrayExpression") {
              for (const el of arg.elements) {
                if (el && el.type === "StringLiteral") {
                  emitNames.push(el.value);
                }
              }
              emitsRuntimeDecl = scriptSetup.content.slice(arg.start!, arg.end!);
            } else if (arg.type === "ObjectExpression") {
              for (const prop of arg.properties) {
                if (prop.type === "ObjectProperty" && prop.key.type === "Identifier") {
                  emitNames.push(prop.key.name);
                }
              }
              emitsRuntimeDecl = scriptSetup.content.slice(arg.start!, arg.end!);
            }
          }
          continue;
        }
      }
      statements.push(scriptSetup.content.slice(node.start!, node.end!));
    } else {
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

  // Add emits if defined
  if (emitsRuntimeDecl) {
    code += `  emits: ${emitsRuntimeDecl},\n`;
  }

  code += "  setup(__props, { emit: __emit }) {\n";

  // Add props destructure if we have a props variable
  if (propsDecl) {
    code += `    const ${propsDecl} = __props\n`;
  }

  // Add emit function if we have an emit variable
  if (emitsDecl) {
    code += `    const ${emitsDecl} = __emit\n`;
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
