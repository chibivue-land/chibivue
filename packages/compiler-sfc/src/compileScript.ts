import { parse as _parse } from "@babel/parser";
import {
  Statement,
  ObjectExpression,
  Node,
  Declaration,
  CallExpression,
  Identifier,
  ObjectPattern,
  ArrayPattern,
  ExportSpecifier,
  LVal,
} from "@babel/types";
import MagicString from "magic-string";

import type { BindingMetadata } from "@chibivue/compiler-core";
import { getImportedName, BindingTypes } from "@chibivue/compiler-core";

import { SFCDescriptor, SFCScriptBlock } from "./parse";
import { compileTemplate } from "./compileTemplate";

const DEFINE_PROPS = "defineProps";
const DEFINE_EMITS = "defineEmits";
const DEFAULT_VAR = `__default__`;

export interface ImportBinding {
  imported: string;
  local: string;
  source: string;
  isFromSetup: boolean;
}

export interface SFCScriptCompileOptions {
  inlineTemplate?: boolean;
}

export function compileScript(
  sfc: SFCDescriptor,
  options: SFCScriptCompileOptions
): SFCScriptBlock {
  let { script, scriptSetup, source } = sfc;

  // prettier-ignore
  const scriptAst = _parse(script?.content ?? "", { sourceType: "module" }).program;
  // prettier-ignore
  const scriptSetupAst = _parse(scriptSetup?.content ?? "", { sourceType: "module" }).program;

  if (!scriptSetup) {
    if (!script) {
      throw new Error(`[@vue/compiler-sfc] SFC contains no <script> tags.`);
    }

    let content = script.content;
    const bindings = analyzeScriptBindings(scriptAst.body);
    return {
      ...script,
      content,
      bindings,
      scriptAst: scriptAst.body,
      scriptSetupAst: scriptSetupAst.body,
    };
  }

  // metadata that needs to be returned
  const bindingMetadata: BindingMetadata = {};
  const userImports: Record<string, ImportBinding> = Object.create(null);
  const scriptBindings: Record<string, BindingTypes> = Object.create(null);
  const setupBindings: Record<string, BindingTypes> = Object.create(null);

  let defaultExport: Node | undefined;
  let propsRuntimeDecl: Node | undefined;
  let propsIdentifier: string | undefined;
  let emitsRuntimeDecl: Node | undefined;
  let emitIdentifier: string | undefined;

  const scriptStartOffset = script && script.loc.start.offset;
  const scriptEndOffset = script && script.loc.end.offset;

  const s = new MagicString(source);
  const startOffset = scriptSetup.loc.start.offset;
  const endOffset = scriptSetup.loc.end.offset;

  function registerUserImport(
    source: string,
    local: string,
    imported: string,
    isFromSetup: boolean
  ) {
    userImports[local] = {
      imported,
      local,
      source,
      isFromSetup,
    };
  }

  function processDefineProps(node: Node, declId?: LVal): boolean {
    if (!isCallOf(node, DEFINE_PROPS)) {
      return false;
    }
    propsRuntimeDecl = node.arguments[0];
    if (declId) {
      propsIdentifier = scriptSetup!.content.slice(declId.start!, declId.end!);
    }
    return true;
  }

  function processDefineEmits(node: Node, declId?: LVal): boolean {
    if (!isCallOf(node, DEFINE_EMITS)) {
      return false;
    }
    emitsRuntimeDecl = node.arguments[0];
    if (declId) {
      emitIdentifier =
        declId.type === "Identifier"
          ? declId.name
          : scriptSetup!.content.slice(declId.start!, declId.end!);
    }
    return true;
  }

  function hoistNode(node: Statement) {
    const start = node.start! + startOffset;
    let end = node.end! + startOffset;
    // locate comment
    if (node.trailingComments && node.trailingComments.length > 0) {
      const lastCommentNode =
        node.trailingComments[node.trailingComments.length - 1];
      end = lastCommentNode.end! + startOffset;
    }
    // locate the end of whitespace between this statement and the next
    while (end <= source.length) {
      if (!/\s/.test(source.charAt(end))) {
        break;
      }
      end++;
    }
    s.move(start, end, 0);
  }

  // 1.1 walk import declaration of <script>
  for (const node of scriptAst.body) {
    if (node.type === "ImportDeclaration") {
      if (node.type === "ImportDeclaration") {
        for (const specifier of node.specifiers) {
          const imported = getImportedName(specifier);
          registerUserImport(
            node.source.value,
            specifier.local.name,
            imported,
            false
          );
        }
      }
    }
  }

  // 1.2 walk import declarations of <script setup>
  for (const node of scriptSetupAst.body) {
    if (node.type === "ImportDeclaration") {
      if (node.type === "ImportDeclaration") {
        hoistNode(node);

        let removed = 0;
        const removeSpecifier = (i: number) => {
          const removeLeft = i > removed;
          removed++;
          const current = node.specifiers[i];
          const next = node.specifiers[i + 1];
          s.remove(
            removeLeft
              ? node.specifiers[i - 1].end! + startOffset
              : current.start! + startOffset,
            next && !removeLeft
              ? next.start! + startOffset
              : current.end! + startOffset
          );
        };

        for (let i = 0; i < node.specifiers.length; i++) {
          const specifier = node.specifiers[i];
          const local = specifier.local.name;
          const imported = getImportedName(specifier);
          const source = node.source.value;
          const existing = userImports[local];
          if (existing) {
            if (existing.source === source && existing.imported === imported) {
              removeSpecifier(i);
            }
          } else {
            registerUserImport(source, local, imported, true);
          }
        }
        if (node.specifiers.length && removed === node.specifiers.length) {
          s.remove(node.start! + startOffset, node.end! + startOffset);
        }
      }
    }
  }

  // 1.3 resolve possible user import alias of `ref` and `reactive`
  const vueImportAliases: Record<string, string> = {};
  for (const key in userImports) {
    const { source, imported, local } = userImports[key];
    if (["chibivue", "chibivue-router", "chibivue-store"].includes(source))
      vueImportAliases[imported] = local;
  }

  // 2.1 process normal <script> body
  if (script && scriptAst) {
    for (const node of scriptAst.body) {
      if (node.type === "ExportDefaultDeclaration") {
        defaultExport = node;
      } else if (node.type === "ExportNamedDeclaration") {
        const defaultSpecifier = node.specifiers.find(
          (s) =>
            s.exported.type === "Identifier" && s.exported.name === "default"
        ) as ExportSpecifier;
        if (defaultSpecifier) {
          defaultExport = node;
          // 1. remove specifier
          if (node.specifiers.length > 1) {
            s.remove(
              defaultSpecifier.start! + scriptStartOffset!,
              defaultSpecifier.end! + scriptStartOffset!
            );
          } else {
            s.remove(
              node.start! + scriptStartOffset!,
              node.end! + scriptStartOffset!
            );
          }
          if (node.source) {
            // export { x as default } from './x'
            // rewrite to `import { x as __default__ } from './x'` and
            // add to top
            s.prepend(
              `import { ${defaultSpecifier.local.name} as ${DEFAULT_VAR} } from '${node.source.value}'\n`
            );
          } else {
            // export { x as default }
            // rewrite to `const __default__ = x` and move to end
            s.appendLeft(
              scriptEndOffset!,
              `\nconst ${DEFAULT_VAR} = ${defaultSpecifier.local.name}\n`
            );
          }
        }
        if (node.declaration) {
          walkDeclaration(node.declaration, scriptBindings, vueImportAliases);
        }
      } else if (
        (node.type === "VariableDeclaration" ||
          node.type === "FunctionDeclaration" ||
          node.type === "ClassDeclaration" ||
          node.type === "TSEnumDeclaration") &&
        !node.declare
      ) {
        walkDeclaration(node, scriptBindings, vueImportAliases);
      }
    }
  }

  // 2.2 process <script setup> body
  for (const node of scriptSetupAst.body) {
    if (
      (node.type === "VariableDeclaration" ||
        node.type === "FunctionDeclaration" ||
        node.type === "ClassDeclaration") &&
      !node.declare
    ) {
      walkDeclaration(node, setupBindings, vueImportAliases);
    }

    if (node.type === "ExpressionStatement") {
      const expr = node.expression;
      if (processDefineProps(expr) || processDefineEmits(expr)) {
        s.remove(node.start! + startOffset, node.end! + startOffset);
      }
    }

    if (node.type === "VariableDeclaration" && !node.declare) {
      const total = node.declarations.length;
      let left = total;
      let lastNonRemoved: number | undefined;
      for (let i = 0; i < total; i++) {
        const decl = node.declarations[i];
        const init = decl.init;
        if (init) {
          const isDefineProps = processDefineProps(init, decl.id);
          const isDefineEmits = processDefineEmits(init, decl.id);
          if (isDefineProps || isDefineEmits) {
            if (left === 1) {
              s.remove(node.start! + startOffset, node.end! + startOffset);
            } else {
              let start = decl.start! + startOffset;
              let end = decl.end! + startOffset;
              if (i === total - 1) {
                start = node.declarations[lastNonRemoved!].end! + startOffset;
              } else {
                end = node.declarations[i + 1].start! + startOffset;
              }
              s.remove(start, end);
              left--;
            }
          } else {
            lastNonRemoved = i;
          }
        }
      }
    }
  }

  // 6. remove non-script content
  if (script) {
    if (startOffset < scriptStartOffset!) {
      // <script setup> before <script>
      s.remove(0, startOffset);
      s.remove(endOffset, scriptStartOffset!);
      s.remove(scriptEndOffset!, source.length);
    } else {
      // <script> before <script setup>
      s.remove(0, scriptStartOffset!);
      s.remove(scriptEndOffset!, startOffset);
      s.remove(endOffset, source.length);
    }
  } else {
    // only <script setup>
    s.remove(0, startOffset);
    s.remove(endOffset, source.length);
  }

  // 7. analyze binding metadata
  if (scriptAst) {
    Object.assign(bindingMetadata, analyzeScriptBindings(scriptAst.body));
  }
  if (propsRuntimeDecl) {
    for (const key of getObjectExpressionKeys(
      propsRuntimeDecl as ObjectExpression
    )) {
      bindingMetadata[key] = BindingTypes.PROPS;
    }
  }
  for (const [key, { imported, source }] of Object.entries(userImports)) {
    bindingMetadata[key] =
      imported === "*" ||
      (imported === "default" && source.endsWith(".vue")) ||
      source === "vue"
        ? BindingTypes.SETUP_CONST
        : BindingTypes.SETUP_MAYBE_REF;
  }
  for (const key in scriptBindings) {
    bindingMetadata[key] = scriptBindings[key];
  }
  for (const key in setupBindings) {
    bindingMetadata[key] = setupBindings[key];
  }

  // 9. finalize setup() argument signature
  let args = `__props`;
  if (propsIdentifier) {
    s.prependLeft(startOffset, `\nconst ${propsIdentifier} = __props;\n`);
  }
  const destructureElements: string[] = [];
  if (emitIdentifier) {
    destructureElements.push(
      emitIdentifier === `emit` ? `emit` : `emit: ${emitIdentifier}`
    );
  }
  if (destructureElements.length) {
    args += `, { ${destructureElements.join(", ")} }`;
  }

  // 10. generate return statement
  let returned;
  if (options.inlineTemplate) {
    if (sfc.template) {
      const { code, preamble } = compileTemplate({
        source: sfc.template.content.trim(),
        compilerOptions: { inline: true, bindingMetadata },
      });

      if (preamble) {
        s.prepend(preamble);
      }
      returned = code;
    } else {
      returned = `() => {}`;
    }
  }
  s.appendRight(endOffset, `\nreturn ${returned}\n`);

  // 11. finalize default export
  let runtimeOptions = ``;
  if (propsRuntimeDecl) {
    let declCode = scriptSetup.content
      .slice(propsRuntimeDecl.start!, propsRuntimeDecl.end!)
      .trim();
    runtimeOptions += `\n  props: ${declCode},`;
  }
  if (emitsRuntimeDecl) {
    runtimeOptions += `\n  emits: ${scriptSetup.content
      .slice(emitsRuntimeDecl.start!, emitsRuntimeDecl.end!)
      .trim()},`;
  }

  if (defaultExport) {
    s.prependLeft(
      startOffset,
      `\nexport default /*#__PURE__*/Object.assign(${
        defaultExport ? `${DEFAULT_VAR}, ` : ""
      }{ setup(${args}) {\n`
    );
    s.appendRight(endOffset, `})`);
  } else {
    s.prependLeft(
      startOffset,
      `\nexport default {\n${runtimeOptions}\nsetup(${args}) {\n`
    );
    s.appendRight(endOffset, `}}`);
  }

  s.trim();

  return {
    ...scriptSetup,
    content: s.toString(),
    imports: userImports,
    scriptAst: scriptAst.body,
    scriptSetupAst: scriptSetupAst.body,
  };
}

function registerBinding(
  bindings: Record<string, BindingTypes>,
  node: Identifier,
  type: BindingTypes
) {
  bindings[node.name] = type;
}

function walkDeclaration(
  node: Declaration,
  bindings: Record<string, BindingTypes>,
  userImportAliases: Record<string, string> = {}
) {
  if (node.type === "VariableDeclaration") {
    const isConst = node.kind === "const";

    for (const { id, init } of node.declarations) {
      if (id.type === "Identifier") {
        let bindingType;
        const userReactiveBinding = userImportAliases["reactive"];
        if (isConst && isStaticNode(init!)) {
          bindingType = BindingTypes.LITERAL_CONST;
        } else if (isCallOf(init, userReactiveBinding)) {
          // treat reactive() calls as let since it's meant to be mutable
          bindingType = BindingTypes.SETUP_REACTIVE_CONST;
        } else if (isConst && canNeverBeRef(init!, userReactiveBinding)) {
          bindingType = BindingTypes.SETUP_CONST;
        } else if (isConst) {
          if (isCallOf(init, userImportAliases["ref"])) {
            bindingType = BindingTypes.SETUP_REF;
          } else {
            bindingType = BindingTypes.SETUP_MAYBE_REF;
          }
        } else {
          bindingType = BindingTypes.SETUP_LET;
        }
        registerBinding(bindings, id, bindingType);
      } else {
        if (id.type === "ObjectPattern") {
          walkObjectPattern(id, bindings, isConst);
        } else if (id.type === "ArrayPattern") {
          walkArrayPattern(id, bindings, isConst);
        }
      }
    }
  } else if (
    node.type === "FunctionDeclaration" ||
    node.type === "ClassDeclaration"
  ) {
    bindings[node.id!.name] = BindingTypes.SETUP_CONST;
  }
}

function walkObjectPattern(
  node: ObjectPattern,
  bindings: Record<string, BindingTypes>,
  isConst: boolean,
  isDefineCall = false
) {
  for (const p of node.properties) {
    if (p.type === "ObjectProperty") {
      if (p.key.type === "Identifier" && p.key === p.value) {
        // shorthand: const { x } = ...
        const type = isDefineCall
          ? BindingTypes.SETUP_CONST
          : isConst
          ? BindingTypes.SETUP_MAYBE_REF
          : BindingTypes.SETUP_LET;
        registerBinding(bindings, p.key, type);
      } else {
        walkPattern(p.value, bindings, isConst, isDefineCall);
      }
    } else {
      // ...rest
      // argument can only be identifier when destructuring
      const type = isConst ? BindingTypes.SETUP_CONST : BindingTypes.SETUP_LET;
      registerBinding(bindings, p.argument as Identifier, type);
    }
  }
}

function walkArrayPattern(
  node: ArrayPattern,
  bindings: Record<string, BindingTypes>,
  isConst: boolean,
  isDefineCall = false
) {
  for (const e of node.elements) {
    e && walkPattern(e, bindings, isConst, isDefineCall);
  }
}

function walkPattern(
  node: Node,
  bindings: Record<string, BindingTypes>,
  isConst: boolean,
  isDefineCall = false
) {
  if (node.type === "Identifier") {
    const type = isDefineCall
      ? BindingTypes.SETUP_CONST
      : isConst
      ? BindingTypes.SETUP_MAYBE_REF
      : BindingTypes.SETUP_LET;
    registerBinding(bindings, node, type);
  } else if (node.type === "RestElement") {
    // argument can only be identifier when destructuring
    const type = isConst ? BindingTypes.SETUP_CONST : BindingTypes.SETUP_LET;
    registerBinding(bindings, node.argument as Identifier, type);
  } else if (node.type === "ObjectPattern") {
    walkObjectPattern(node, bindings, isConst);
  } else if (node.type === "ArrayPattern") {
    walkArrayPattern(node, bindings, isConst);
  } else if (node.type === "AssignmentPattern") {
    if (node.left.type === "Identifier") {
      const type = isDefineCall
        ? BindingTypes.SETUP_CONST
        : isConst
        ? BindingTypes.SETUP_MAYBE_REF
        : BindingTypes.SETUP_LET;
      registerBinding(bindings, node.left, type);
    } else {
      walkPattern(node.left, bindings, isConst);
    }
  }
}

function analyzeScriptBindings(ast: Statement[]): BindingMetadata {
  for (const node of ast) {
    if (
      node.type === "ExportDefaultDeclaration" &&
      node.declaration.type === "ObjectExpression"
    ) {
      return analyzeBindingsFromOptions(node.declaration);
    }
  }
  return {};
}

function analyzeBindingsFromOptions(node: ObjectExpression): BindingMetadata {
  const bindings: BindingMetadata = {};
  Object.defineProperty(bindings, "__isScriptSetup", {
    enumerable: false,
    value: false,
  });

  for (const property of node.properties) {
    if (
      property.type === "ObjectProperty" &&
      !property.computed &&
      property.key.type === "Identifier"
    ) {
      // props
      if (
        property.value.type === "ObjectExpression" &&
        property.key.name === "props"
      ) {
        for (const key of getObjectExpressionKeys(property.value)) {
          bindings[key] = BindingTypes.PROPS;
        }
      }

      // computed & methods
      if (
        property.value.type === "ObjectExpression" &&
        (property.key.name === "computed" || property.key.name === "methods")
      ) {
        // methods: { foo() {} }
        // computed: { foo() {} }
        for (const key of getObjectExpressionKeys(property.value)) {
          bindings[key] = BindingTypes.OPTIONS;
        }
      }
    }

    // setup & data
    else if (
      property.type === "ObjectMethod" &&
      property.key.type === "Identifier" &&
      (property.key.name === "setup" || property.key.name === "data")
    ) {
      for (const bodyItem of property.body.body) {
        // setup() {
        //   return {
        //     foo: null
        //   }
        // }
        if (
          bodyItem.type === "ReturnStatement" &&
          bodyItem.argument &&
          bodyItem.argument.type === "ObjectExpression"
        ) {
          for (const key of getObjectExpressionKeys(bodyItem.argument)) {
            bindings[key] =
              property.key.name === "setup"
                ? BindingTypes.SETUP_MAYBE_REF
                : BindingTypes.DATA;
          }
        }
      }
    }
  }

  return bindings;
}

function getObjectExpressionKeys(node: ObjectExpression): string[] {
  const keys: string[] = [];
  for (const prop of node.properties) {
    if (prop.type === "SpreadElement") continue;
    const key = resolveObjectKey(prop.key, prop.computed);
    if (key) keys.push(String(key));
  }
  return keys;
}

export function resolveObjectKey(node: Node, computed: boolean) {
  switch (node.type) {
    case "StringLiteral":
    case "NumericLiteral":
      return node.value;
    case "Identifier":
      if (!computed) return node.name;
  }
  return undefined;
}

function isCallOf(
  node: Node | null | undefined,
  test: string | ((id: string) => boolean) | null | undefined
): node is CallExpression {
  return !!(
    node &&
    test &&
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    (typeof test === "string"
      ? node.callee.name === test
      : test(node.callee.name))
  );
}

function canNeverBeRef(node: Node, userReactiveImport?: string): boolean {
  if (isCallOf(node, userReactiveImport)) {
    return true;
  }
  switch (node.type) {
    case "UnaryExpression":
    case "BinaryExpression":
    case "ArrayExpression":
    case "ObjectExpression":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
    case "UpdateExpression":
    case "ClassExpression":
    case "TaggedTemplateExpression":
      return true;
    case "SequenceExpression":
      return canNeverBeRef(
        node.expressions[node.expressions.length - 1],
        userReactiveImport
      );
    default:
      if (isLiteralNode(node)) {
        return true;
      }
      return false;
  }
}

function isStaticNode(node: Node): boolean {
  switch (node.type) {
    case "UnaryExpression": // void 0, !true
      return isStaticNode(node.argument);

    case "LogicalExpression": // 1 > 2
    case "BinaryExpression": // 1 + 2
      return isStaticNode(node.left) && isStaticNode(node.right);

    case "ConditionalExpression": {
      // 1 ? 2 : 3
      return (
        isStaticNode(node.test) &&
        isStaticNode(node.consequent) &&
        isStaticNode(node.alternate)
      );
    }

    case "SequenceExpression": // (1, 2)
    case "TemplateLiteral": // `foo${1}`
      return node.expressions.every((expr) => isStaticNode(expr));

    case "ParenthesizedExpression": // (1)
    case "TSNonNullExpression": // 1!
    case "TSAsExpression": // 1 as number
    case "TSTypeAssertion": // (<number>2)
      return isStaticNode(node.expression);

    default:
      if (isLiteralNode(node)) {
        return true;
      }
      return false;
  }
}

function isLiteralNode(node: Node) {
  return node.type.endsWith("Literal");
}
