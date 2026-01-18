import { isString } from "@chibivue/shared";

import {
  CREATE_ELEMENT_VNODE,
  CREATE_VNODE,
  type FRAGMENT,
  type RENDER_LIST,
  WITH_DIRECTIVES,
} from "./runtimeHelpers";
import type { TransformContext } from "./transform";
import type { PropsExpression } from "./transforms/transformElement";
import type { ForParseResult } from "./transforms/vFor";

export const enum NodeTypes {
  ROOT,
  ELEMENT,
  TEXT,
  COMMENT,
  INTERPOLATION,
  SIMPLE_EXPRESSION,

  ATTRIBUTE,
  DIRECTIVE,

  COMPOUND_EXPRESSION,
  IF,
  IF_BRANCH,
  FOR,

  // codegen
  VNODE_CALL,
  JS_CALL_EXPRESSION,
  JS_OBJECT_EXPRESSION,
  JS_PROPERTY,
  JS_ARRAY_EXPRESSION,
  JS_FUNCTION_EXPRESSION,
  JS_CONDITIONAL_EXPRESSION,

  // SSR codegen
  JS_TEMPLATE_LITERAL,
  JS_IF_STATEMENT,
  JS_BLOCK_STATEMENT,
}

export const enum ElementTypes {
  ELEMENT,
  COMPONENT,
  TEMPLATE,
}

export interface SourceLocation {
  start: Position;
  end: Position;
  source: string;
}

export interface Node {
  type: NodeTypes;
  loc: SourceLocation;
}

export interface Position {
  offset: number; // from start of file
  line: number;
  column: number;
}

export type ParentNode = RootNode | ElementNode | ForNode | IfBranchNode;

export type ExpressionNode = SimpleExpressionNode | CompoundExpressionNode;

export type TemplateChildNode =
  | ElementNode
  | TextNode
  | InterpolationNode
  | CommentNode
  | IfNode
  | IfBranchNode
  | ForNode;

export type TemplateTextChildNode = TextNode | InterpolationNode;

export interface VNodeCall extends Node {
  type: NodeTypes.VNODE_CALL;
  tag: string | symbol | CallExpression;
  props: PropsExpression | undefined;
  children:
    | TemplateChildNode[] // multiple children
    | ForRenderListExpression // v-for
    | TemplateTextChildNode
    | SimpleExpressionNode // hoisted
    | undefined;
  directives: DirectiveArguments | undefined;
  isComponent: boolean;
  isStatic?: boolean;
}

// JS Node Types ---------------------------------------------------------------

// We also include a number of JavaScript AST nodes for code generation.
// The AST is an intentionally minimal subset just to meet the exact needs of
// Vue render function generation.

export type JSChildNode =
  | VNodeCall
  | CallExpression
  | ObjectExpression
  | ArrayExpression
  | ExpressionNode
  | FunctionExpression
  | ConditionalExpression;

export interface CallExpression extends Node {
  type: NodeTypes.JS_CALL_EXPRESSION;
  callee: string | symbol;
  arguments: (string | JSChildNode | TemplateLiteral | TemplateChildNode | TemplateChildNode[])[];
}

export interface ObjectExpression extends Node {
  type: NodeTypes.JS_OBJECT_EXPRESSION;
  properties: Array<Property>;
}
export interface Property extends Node {
  type: NodeTypes.JS_PROPERTY;
  key: ExpressionNode;
  value: JSChildNode;
}

export interface ArrayExpression extends Node {
  type: NodeTypes.JS_ARRAY_EXPRESSION;
  elements: Array<string | Node>;
}

export interface FunctionExpression extends Node {
  type: NodeTypes.JS_FUNCTION_EXPRESSION;
  params: ExpressionNode | string | (ExpressionNode | string)[] | undefined;
  returns?: TemplateChildNode | TemplateChildNode[] | JSChildNode;
  body?: BlockStatement | IfStatement;
  newline: boolean;
  /**
   * This flag is for codegen to determine whether it needs to generate the
   * withScopeId() wrapper
   */
  isSlot: boolean;
  /**
   * __COMPAT__ only, indicates a slot function that should be excluded from
   * the legacy $scopedSlots instance property.
   */
  isNonScopedSlot?: boolean;
}

export interface ConditionalExpression extends Node {
  type: NodeTypes.JS_CONDITIONAL_EXPRESSION;
  test: JSChildNode;
  consequent: JSChildNode;
  alternate: JSChildNode;
  newline: boolean;
}

// SSR types
export interface TemplateLiteral extends Node {
  type: NodeTypes.JS_TEMPLATE_LITERAL;
  elements: (string | JSChildNode)[];
}

export interface IfStatement extends Node {
  type: NodeTypes.JS_IF_STATEMENT;
  test: JSChildNode;
  consequent: BlockStatement;
  alternate: IfStatement | BlockStatement | undefined;
}

export interface BlockStatement extends Node {
  type: NodeTypes.JS_BLOCK_STATEMENT;
  body: (JSChildNode | IfStatement)[];
}

export interface RootNode extends Node {
  type: NodeTypes.ROOT;
  children: TemplateChildNode[];
  codegenNode?: TemplateChildNode | VNodeCall | BlockStatement;
  helpers: Set<symbol>;
  components: string[];
  hoists: (TemplateChildNode | ExpressionNode)[];
  // SSR
  ssrHelpers?: symbol[];
}

export type ElementNode = PlainElementNode | ComponentNode | TemplateNode;

export interface BaseElementNode extends Node {
  type: NodeTypes.ELEMENT;
  tag: string;
  tagType: ElementTypes;
  props: Array<AttributeNode | DirectiveNode>;
  children: TemplateChildNode[];
  isSelfClosing: boolean;
}

export interface PlainElementNode extends BaseElementNode {
  tagType: ElementTypes.ELEMENT;
  codegenNode: VNodeCall | SimpleExpressionNode | undefined;
  ssrCodegenNode?: TemplateLiteral;
}

export interface TemplateNode extends BaseElementNode {
  tagType: ElementTypes.TEMPLATE;
  // TemplateNode is a container type that always gets compiled away
  codegenNode: undefined;
}

export interface TextNode extends Node {
  type: NodeTypes.TEXT;
  content: string;
}

export interface CommentNode extends Node {
  type: NodeTypes.COMMENT;
  content: string;
}

export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION;
  content: ExpressionNode;
}

export interface ComponentNode extends BaseElementNode {
  tagType: ElementTypes.COMPONENT;
  codegenNode: VNodeCall | undefined;
}

export interface SimpleExpressionNode extends Node {
  type: NodeTypes.SIMPLE_EXPRESSION;
  content: string;
  isStatic: boolean;
  identifiers?: string[];
}

export interface CompoundExpressionNode extends Node {
  type: NodeTypes.COMPOUND_EXPRESSION;
  children: (
    | SimpleExpressionNode
    | CompoundExpressionNode
    | InterpolationNode
    | TextNode
    | string
    | symbol
  )[];

  /**
   * an expression parsed as the params of a function will track
   * the identifiers declared inside the function body.
   */
  identifiers?: string[];
  isHandlerKey?: boolean;
}

export interface IfNode extends Node {
  type: NodeTypes.IF;
  branches: IfBranchNode[];
  codegenNode?: IfConditionalExpression;
}

export interface IfConditionalExpression extends ConditionalExpression {
  consequent: VNodeCall;
  alternate: VNodeCall | IfConditionalExpression;
}

export interface IfBranchNode extends Node {
  type: NodeTypes.IF_BRANCH;
  condition: ExpressionNode | undefined; // else
  children: TemplateChildNode[];
  userKey?: AttributeNode | DirectiveNode;
}

export interface ForNode extends Node {
  type: NodeTypes.FOR;
  source: ExpressionNode;
  valueAlias: ExpressionNode | undefined;
  keyAlias: ExpressionNode | undefined;
  children: TemplateChildNode[];
  parseResult: ForParseResult;
  codegenNode?: ForCodegenNode;
}

export interface AttributeNode extends Node {
  type: NodeTypes.ATTRIBUTE;
  name: string;
  value: TextNode | undefined;
}

export interface DirectiveNode extends Node {
  type: NodeTypes.DIRECTIVE;
  name: string;
  exp: ExpressionNode | undefined;
  arg: ExpressionNode | undefined;
  modifiers: string[];
}

// Codegen Node Types ----------------------------------------------------------

export interface DirectiveArguments extends ArrayExpression {
  elements: DirectiveArgumentNode[];
}

export interface DirectiveArgumentNode extends ArrayExpression {
  elements: // dir, exp, arg, modifiers
    | [string]
    | [string, ExpressionNode]
    | [string, ExpressionNode, ExpressionNode]
    | [string, ExpressionNode, ExpressionNode, ObjectExpression];
}

export interface ForCodegenNode extends VNodeCall {
  isBlock: true;
  tag: typeof FRAGMENT;
  props: undefined;
  children: ForRenderListExpression;
  patchFlag: string;
  disableTracking: boolean;
}

export interface ForRenderListExpression extends CallExpression {
  callee: typeof RENDER_LIST;
  arguments: [ExpressionNode, ForIteratorExpression];
}

export interface ForIteratorExpression extends FunctionExpression {
  returns: VNodeCall;
}

// AST Utilities ---------------------------------------------------------------

export const locStub: SourceLocation = {
  source: "",
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 },
};

export function createRoot(children: TemplateChildNode[], loc: SourceLocation = locStub): RootNode {
  return {
    type: NodeTypes.ROOT,
    children,
    components: [],
    helpers: new Set(),
    hoists: [],
    codegenNode: undefined,
    loc,
  };
}

export function createVNodeCall(
  context: TransformContext | null,
  tag: VNodeCall["tag"],
  props?: VNodeCall["props"],
  children?: VNodeCall["children"],
  directives?: VNodeCall["directives"],
  isComponent: VNodeCall["isComponent"] = false,
  loc: SourceLocation = locStub,
): VNodeCall {
  if (context) {
    context.helper(getVNodeHelper(isComponent));
    if (directives) {
      context.helper(WITH_DIRECTIVES);
    }
  }

  return {
    type: NodeTypes.VNODE_CALL,
    tag,
    props,
    children,
    directives,
    isComponent,
    loc,
  };
}

export function createArrayExpression(
  elements: ArrayExpression["elements"],
  loc: SourceLocation = locStub,
): ArrayExpression {
  return {
    type: NodeTypes.JS_ARRAY_EXPRESSION,
    elements,
    loc,
  };
}

export function createObjectExpression(
  properties: ObjectExpression["properties"],
  loc: SourceLocation = locStub,
): ObjectExpression {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    properties,
    loc,
  };
}

export function createObjectProperty(
  key: Property["key"] | string,
  value: Property["value"],
  loc: SourceLocation = locStub,
): Property {
  return {
    type: NodeTypes.JS_PROPERTY,
    key: isString(key) ? createSimpleExpression(key, true) : key,
    value,
    loc,
  };
}

export function createSimpleExpression(
  content: SimpleExpressionNode["content"],
  isStatic: SimpleExpressionNode["isStatic"] = false,
  loc: SourceLocation = locStub,
): SimpleExpressionNode {
  return {
    type: NodeTypes.SIMPLE_EXPRESSION,
    isStatic,
    content,
    loc,
  };
}

export function createCompoundExpression(
  children: CompoundExpressionNode["children"],
  loc: SourceLocation = locStub,
): CompoundExpressionNode {
  return {
    type: NodeTypes.COMPOUND_EXPRESSION,
    children,
    loc,
  };
}

export function createCallExpression<T extends CallExpression["callee"]>(
  callee: T,
  args: CallExpression["arguments"] = [],
  loc: SourceLocation = locStub,
): CallExpression {
  return {
    type: NodeTypes.JS_CALL_EXPRESSION,
    loc,
    callee,
    arguments: args,
  } as CallExpression;
}

export function createFunctionExpression(
  params: FunctionExpression["params"],
  returns: FunctionExpression["returns"] = undefined,
  newline: boolean = false,
  isSlot: boolean = false,
  loc: SourceLocation = locStub,
): FunctionExpression {
  return {
    type: NodeTypes.JS_FUNCTION_EXPRESSION,
    params,
    returns,
    newline,
    isSlot,
    loc,
  };
}

export function getVNodeHelper(
  isComponent: boolean,
): typeof CREATE_VNODE | typeof CREATE_ELEMENT_VNODE {
  return isComponent ? CREATE_VNODE : CREATE_ELEMENT_VNODE;
}

export function createConditionalExpression(
  test: ConditionalExpression["test"],
  consequent: ConditionalExpression["consequent"],
  alternate: ConditionalExpression["alternate"],
  newline = true,
): ConditionalExpression {
  return {
    type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
    test,
    consequent,
    alternate,
    newline,
    loc: locStub,
  };
}

// SSR factories
export function createTemplateLiteral(
  elements: TemplateLiteral["elements"],
): TemplateLiteral {
  return {
    type: NodeTypes.JS_TEMPLATE_LITERAL,
    elements,
    loc: locStub,
  };
}

export function createBlockStatement(
  body: BlockStatement["body"],
): BlockStatement {
  return {
    type: NodeTypes.JS_BLOCK_STATEMENT,
    body,
    loc: locStub,
  };
}

export function createIfStatement(
  test: IfStatement["test"],
  consequent: IfStatement["consequent"],
  alternate?: IfStatement["alternate"],
): IfStatement {
  return {
    type: NodeTypes.JS_IF_STATEMENT,
    test,
    consequent,
    alternate,
    loc: locStub,
  };
}
