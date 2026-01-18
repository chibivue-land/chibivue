import { isArray, isString, isSymbol } from "@chibivue/shared";
import {
  type ArrayExpression,
  type BlockStatement,
  type CallExpression,
  type CommentNode,
  type CompoundExpressionNode,
  type ConditionalExpression,
  type ExpressionNode,
  type FunctionExpression,
  type IfStatement,
  type InterpolationNode,
  type JSChildNode,
  NodeTypes,
  type ObjectExpression,
  type RootNode,
  type SimpleExpressionNode,
  type TemplateChildNode,
  type TemplateLiteral,
  type TextNode,
  type VNodeCall,
} from "./ast";
import type { CodegenOptions } from "./options";
import {
  CREATE_COMMENT,
  CREATE_ELEMENT_VNODE,
  RESOLVE_COMPONENT,
  TO_DISPLAY_STRING,
  WITH_DIRECTIVES,
  helperNameMap,
} from "./runtimeHelpers";
import { toValidAssetId } from "./transforms/transformElement";

const aliasHelper = (s: symbol) => `${helperNameMap[s]}: _${helperNameMap[s]}`;

export interface CodegenResult {
  code: string;
  preamble: string;
  ast: RootNode;
}

type CodegenNode = TemplateChildNode | JSChildNode | TemplateLiteral | IfStatement | BlockStatement;

export interface CodegenContext {
  source: string;
  code: string;
  line: number;
  column: number;
  offset: number;
  indentLevel: number;
  runtimeGlobalName: string;
  runtimeModuleName: string;
  inline?: boolean;
  scopeId?: string;
  ssr?: boolean;
  helper(key: symbol): string;
  push(code: string, node?: CodegenNode): void;
  indent(): void;
  deindent(withoutNewLine?: boolean): void;
  newline(): void;
  isBrowser: boolean;
}

function createCodegenContext(
  ast: RootNode,
  { isBrowser = false, scopeId, ssr = false }: CodegenOptions,
): CodegenContext {
  const context: CodegenContext = {
    source: ast.loc.source,
    code: ``,
    column: 1,
    line: 1,
    offset: 0,
    indentLevel: 0,
    runtimeGlobalName: `ChibiVue`,
    runtimeModuleName: "chibivue",
    isBrowser,
    scopeId,
    ssr,
    helper(key) {
      return `_${helperNameMap[key]}`;
    },
    push(code) {
      context.code += code;
    },
    indent() {
      newline(++context.indentLevel);
    },
    deindent(withoutNewLine = false) {
      if (withoutNewLine) {
        --context.indentLevel;
      } else {
        newline(--context.indentLevel);
      }
    },
    newline() {
      newline(context.indentLevel);
    },
  };

  function newline(n: number) {
    context.push("\n" + `  `.repeat(n));
  }

  return context;
}

export function generate(ast: RootNode, options: CodegenOptions): CodegenResult {
  const context = createCodegenContext(ast, {
    isBrowser: options.isBrowser,
    scopeId: options.scopeId,
    ssr: options.ssr,
  });
  const { push } = context;
  const isSetupInlined = !options.isBrowser && !!options.inline;
  const ssr = !!options.ssr;

  const preambleContext = isSetupInlined ? createCodegenContext(ast, options) : context;

  genFunctionPreamble(ast, preambleContext);

  // generate hoisted nodes
  if (ast.hoists.length) {
    genHoists(ast.hoists, preambleContext);
    preambleContext.newline();
  }

  const functionName = ssr ? `ssrRender` : `render`;
  const args = ssr ? ["_ctx", "_push", "_parent", "_attrs"] : ["_ctx"];
  const signature = args.join(", ");

  push(`function ${functionName}(${signature}) { `);
  context.indent();

  // generate asset resolution statements
  if (ast.components.length) {
    genAssets(ast.components, context);
    context.newline();
  }

  if (!ssr) {
    push(`return `);
  }
  if (ast.codegenNode) {
    genNode(ast.codegenNode, context);
  } else if (!ssr) {
    push(`null`);
  }

  context.deindent();
  push(` }`);

  return {
    ast,
    preamble: isSetupInlined ? preambleContext.code : ``,
    code: context.code,
  };
}

function genFunctionPreamble(ast: RootNode, context: CodegenContext) {
  const { push, newline, runtimeGlobalName, runtimeModuleName, isBrowser, ssr } = context;

  if (isBrowser) {
    push(`const _ChibiVue = ${runtimeGlobalName}\n`);
  } else {
    push(`import * as _ChibiVue from '${runtimeModuleName}'\n`);
    if (ssr && ast.ssrHelpers?.length) {
      push(
        `import { ${ast.ssrHelpers.map(aliasHelper).join(", ")} } from '${runtimeModuleName}/server-renderer'\n`,
      );
    }
  }

  const helpers = Array.from(ast.helpers);
  if (helpers.length) {
    push(`const { ${helpers.map(aliasHelper).join(", ")} } = _ChibiVue\n`);
  }
  newline();
  if (isBrowser) push(`return `);
}

function genNode(node: CodegenNode | symbol | string, context: CodegenContext) {
  if (isString(node)) {
    context.push(node);
    return;
  }

  if (isSymbol(node)) {
    context.push(context.helper(node));
    return;
  }

  switch (node.type) {
    case NodeTypes.ELEMENT:
    case NodeTypes.IF:
    case NodeTypes.FOR: {
      genNode(node.codegenNode!, context);
      break;
    }
    case NodeTypes.TEXT:
      genText(node, context);
      break;
    case NodeTypes.SIMPLE_EXPRESSION:
      genExpression(node, context);
      break;
    case NodeTypes.INTERPOLATION:
      genInterpolation(node, context);
      break;
    case NodeTypes.VNODE_CALL:
      genVNodeCall(node, context);
      break;
    case NodeTypes.COMPOUND_EXPRESSION:
      genCompoundExpression(node, context);
      break;
    case NodeTypes.COMMENT:
      genComment(node, context);
      break;
    case NodeTypes.JS_CALL_EXPRESSION:
      genCallExpression(node, context);
      break;
    case NodeTypes.JS_OBJECT_EXPRESSION:
      genObjectExpression(node, context);
      break;
    case NodeTypes.JS_ARRAY_EXPRESSION:
      genArrayExpression(node, context);
      break;
    case NodeTypes.JS_FUNCTION_EXPRESSION:
      genFunctionExpression(node, context);
      break;
    case NodeTypes.JS_CONDITIONAL_EXPRESSION:
      genConditionalExpression(node, context);
      break;
    // SSR
    case NodeTypes.JS_TEMPLATE_LITERAL:
      genTemplateLiteral(node, context);
      break;
    case NodeTypes.JS_IF_STATEMENT:
      genIfStatement(node, context);
      break;
    case NodeTypes.JS_BLOCK_STATEMENT:
      genBlockStatement(node, context);
      break;
    /* istanbul ignore next */
    case NodeTypes.IF_BRANCH:
      // noop
      break;
    default: {
      // make sure we exhaust all possible types
      const exhaustiveCheck: never = node;
      return exhaustiveCheck;
    }
  }
}

function genText(node: TextNode, context: CodegenContext) {
  context.push(JSON.stringify(node.content), node);
}

function genExpression(node: SimpleExpressionNode, context: CodegenContext) {
  const { content, isStatic } = node;
  context.push(isStatic ? JSON.stringify(content) : content, node);
}

function genInterpolation(node: InterpolationNode, context: CodegenContext) {
  const { push, helper } = context;
  push(`${helper(TO_DISPLAY_STRING)}(`);
  genNode(node.content, context);
  push(`)`);
}

function genCompoundExpression(node: CompoundExpressionNode, context: CodegenContext) {
  for (let i = 0; i < node.children!.length; i++) {
    const child = node.children![i];
    if (isString(child)) {
      context.push(child);
    } else {
      genNode(child, context);
    }
  }
}

function genExpressionAsPropertyKey(node: ExpressionNode, context: CodegenContext) {
  const { push } = context;
  if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
    push(`[`);
    genCompoundExpression(node, context);
    push(`]`);
  } else if (node.isStatic) {
    push(JSON.stringify(node.content), node);
  } else {
    push(`[${node.content}]`, node);
  }
}

function genComment(node: CommentNode, context: CodegenContext) {
  const { push, helper } = context;
  push(`${helper(CREATE_COMMENT)}(${JSON.stringify(node.content)})`, node);
}

function genVNodeCall(node: VNodeCall, context: CodegenContext) {
  const { push, helper, scopeId } = context;
  const { tag, props, children, directives } = node;
  if (directives) {
    push(helper(WITH_DIRECTIVES) + `(`);
  }
  push(helper(CREATE_ELEMENT_VNODE) + `(`, node);

  // Add scopeId to props if present
  let propsWithScope = props;
  if (scopeId) {
    const scopeIdProp = `"data-v-${scopeId}": ""`;
    if (props) {
      // Merge with existing props
      propsWithScope = `{ ...${genPropsString(props, context)}, ${scopeIdProp} }` as any;
    } else {
      propsWithScope = `{ ${scopeIdProp} }` as any;
    }
    genNodeList(genNullableArgs([tag, propsWithScope, children]), context);
  } else {
    genNodeList(genNullableArgs([tag, props, children]), context);
  }

  push(`)`);
  if (directives) {
    push(`, `);
    genNode(directives, context);
    push(`)`);
  }
}

function genPropsString(props: VNodeCall["props"], context: CodegenContext): string {
  if (!props) return "{}";
  if (typeof props === "string") return props;

  // Generate the props to a temporary string
  const tempContext: CodegenContext = {
    ...context,
    code: "",
    push(code: string) {
      tempContext.code += code;
    },
  };
  genNode(props, tempContext);
  return tempContext.code;
}

function genNullableArgs(args: any[]): CallExpression["arguments"] {
  let i = args.length;
  while (i--) {
    if (args[i] != null) break;
  }
  return args.slice(0, i + 1).map((arg) => arg || `null`);
}

// JavaScript
function genCallExpression(node: CallExpression, context: CodegenContext) {
  const { push, helper } = context;
  const callee = isString(node.callee) ? node.callee : helper(node.callee);
  push(callee + `(`, node);
  genNodeList(node.arguments, context);
  push(`)`);
}

function genObjectExpression(node: ObjectExpression, context: CodegenContext) {
  const { push } = context;
  const { properties } = node;

  if (!properties.length) {
    push(`{}`, node);
    return;
  }

  push(`{ `);
  for (let i = 0; i < properties.length; i++) {
    const { key, value } = properties[i];
    // key
    genExpressionAsPropertyKey(key, context);
    push(`: `);
    // value
    genNode(value, context);
    if (i < properties.length - 1) {
      // will only reach this if it's multilines
      push(`,`);
    }
  }
  push(` }`);
}

function genArrayExpression(node: ArrayExpression, context: CodegenContext) {
  genNodeListAsArray(node.elements as CodegenNode[], context);
}

function genFunctionExpression(node: FunctionExpression, context: CodegenContext) {
  const { push, indent, deindent } = context;
  const { params, returns, body, newline } = node;

  push(`(`, node);
  if (isArray(params)) {
    genNodeList(params, context);
  } else if (params) {
    genNode(params, context);
  }
  push(`) => `);
  if (newline || body) {
    push(`{`);
    indent();
  }
  if (body) {
    genNode(body, context);
  } else if (returns) {
    if (newline) {
      push(`return `);
    }
    if (isArray(returns)) {
      genNodeListAsArray(returns, context);
    } else {
      genNode(returns, context);
    }
  }
  if (newline || body) {
    deindent();
    push(`}`);
  }
}

function genConditionalExpression(node: ConditionalExpression, context: CodegenContext) {
  const { test, consequent, alternate, newline: needNewline } = node;
  const { push, indent, deindent, newline } = context;
  if (test.type === NodeTypes.SIMPLE_EXPRESSION) {
    genExpression(test, context);
  } else {
    push(`(`);
    genNode(test, context);
    push(`)`);
  }
  needNewline && indent();
  context.indentLevel++;
  needNewline || push(` `);
  push(`? `);
  genNode(consequent, context);
  context.indentLevel--;
  needNewline && newline();
  needNewline || push(` `);
  push(`: `);
  const isNested = alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION;
  if (!isNested) {
    context.indentLevel++;
  }
  genNode(alternate, context);
  if (!isNested) {
    context.indentLevel--;
  }
  needNewline && deindent(true /* without newline */);
}

function genNodeListAsArray(
  nodes: (string | CodegenNode | TemplateChildNode[])[],
  context: CodegenContext,
) {
  context.push(`[`);
  genNodeList(nodes, context);
  context.push(`]`);
}

function genNodeList(
  nodes: (string | CodegenNode | TemplateChildNode[])[],
  context: CodegenContext,
  comma: boolean = true,
) {
  const { push } = context;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (isString(node)) {
      push(node);
    } else if (isArray(node)) {
      genNodeListAsArray(node, context);
    } else {
      genNode(node, context);
    }

    if (i < nodes.length - 1) {
      comma && push(", ");
    }
  }
}

function genAssets(assets: string[], { helper, push, newline }: CodegenContext) {
  const resolver = helper(RESOLVE_COMPONENT);
  for (let i = 0; i < assets.length; i++) {
    let id = assets[i];
    const maybeSelfReference = id.endsWith("__self");
    if (maybeSelfReference) {
      id = id.slice(0, -6);
    }
    push(
      `const ${toValidAssetId(id, "component")} = ${resolver}(${JSON.stringify(
        id,
      )}${maybeSelfReference ? `, true` : ``})`,
    );
    if (i < assets.length - 1) {
      newline();
    }
  }
}

function genHoists(hoists: (TemplateChildNode | ExpressionNode)[], context: CodegenContext) {
  const { push, newline } = context;
  for (let i = 0; i < hoists.length; i++) {
    const exp = hoists[i];
    if (exp) {
      push(`const _hoisted_${i + 1} = `);
      genNode(exp, context);
      newline();
    }
  }
}

// SSR codegen
function genTemplateLiteral(node: TemplateLiteral, context: CodegenContext) {
  const { push, indent, deindent } = context;
  push("`");
  const l = node.elements.length;
  const multilines = l > 3;
  for (let i = 0; i < l; i++) {
    const e = node.elements[i];
    if (isString(e)) {
      push(e.replace(/(`|\$|\\)/g, "\\$1"));
    } else {
      push("${");
      if (multilines) indent();
      genNode(e, context);
      if (multilines) deindent();
      push("}");
    }
  }
  push("`");
}

function genIfStatement(node: IfStatement, context: CodegenContext) {
  const { push, indent, deindent } = context;
  const { test, consequent, alternate } = node;
  push(`if (`);
  genNode(test, context);
  push(`) {`);
  indent();
  genNode(consequent, context);
  deindent();
  push(`}`);
  if (alternate) {
    push(` else `);
    if (alternate.type === NodeTypes.JS_IF_STATEMENT) {
      genIfStatement(alternate, context);
    } else {
      push(`{`);
      indent();
      genNode(alternate, context);
      deindent();
      push(`}`);
    }
  }
}

function genBlockStatement(node: BlockStatement, context: CodegenContext) {
  const { push, indent, deindent, newline } = context;
  for (let i = 0; i < node.body.length; i++) {
    genNode(node.body[i], context);
    if (i < node.body.length - 1) {
      newline();
    }
  }
}
