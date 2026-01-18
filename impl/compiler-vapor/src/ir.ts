import type { SimpleExpressionNode, RootNode, TemplateChildNode } from "@chibivue/compiler-core";

export enum IRNodeTypes {
  ROOT = "root",
  BLOCK = "block",

  // DOM Operations
  SET_TEXT = "setText",
  SET_EVENT = "setEvent",
  SET_PROP = "setProp",

  // Structure
  INSERT_NODE = "insertNode",

  // Control Flow
  IF = "if",
  FOR = "for",
}

export enum DynamicFlag {
  NONE = 0,
  REFERENCED = 1,
  NON_TEMPLATE = 2,
  INSERT = 4,
}

export interface IRDynamicInfo {
  id?: number;
  flags: DynamicFlag;
}

export interface IREffect {
  expressions: SimpleExpressionNode[];
  operations: OperationNode[];
}

// Root IR Node
export interface RootIRNode {
  type: IRNodeTypes.ROOT;
  node: RootNode;
  source: string;
  template: string[];
  block: BlockIRNode;
}

// Block IR Node - container for operations and effects
export interface BlockIRNode {
  type: IRNodeTypes.BLOCK;
  node: RootNode | TemplateChildNode;
  dynamic: IRDynamicInfo;
  effect: IREffect[];
  operation: OperationNode[];
  returns: number[];
}

// Operation Nodes
export interface SetTextIRNode {
  type: IRNodeTypes.SET_TEXT;
  element: number;
  values: SimpleExpressionNode[];
}

export interface SetEventIRNode {
  type: IRNodeTypes.SET_EVENT;
  element: number;
  key: string;
  value: SimpleExpressionNode;
  modifiers?: string[];
}

export interface SetPropIRNode {
  type: IRNodeTypes.SET_PROP;
  element: number;
  key: string;
  value: SimpleExpressionNode;
}

export interface InsertNodeIRNode {
  type: IRNodeTypes.INSERT_NODE;
  element: number;
  parent: number;
  anchor?: number;
}

export interface IfIRNode {
  type: IRNodeTypes.IF;
  id: number;
  condition: SimpleExpressionNode;
  positive: BlockIRNode;
  negative?: BlockIRNode | IfIRNode;
  once?: boolean;
}

export interface ForIRNode {
  type: IRNodeTypes.FOR;
  id: number;
  source: SimpleExpressionNode;
  value?: SimpleExpressionNode;
  key?: SimpleExpressionNode;
  index?: SimpleExpressionNode;
  render: BlockIRNode;
  once?: boolean;
}

export type OperationNode =
  | SetTextIRNode
  | SetEventIRNode
  | SetPropIRNode
  | InsertNodeIRNode
  | IfIRNode
  | ForIRNode;

// Helper to create a new block
export function createBlock(node: RootNode | TemplateChildNode): BlockIRNode {
  return {
    type: IRNodeTypes.BLOCK,
    node,
    dynamic: { flags: DynamicFlag.NONE },
    effect: [],
    operation: [],
    returns: [],
  };
}

// Helper to create root IR
export function createRootIR(node: RootNode, source: string): RootIRNode {
  return {
    type: IRNodeTypes.ROOT,
    node,
    source,
    template: [],
    block: createBlock(node),
  };
}
