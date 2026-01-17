import { isArray, isString } from "../shared";
import {
  type DirectiveNode,
  type ElementNode,
  NodeTypes,
  type ParentNode,
  type Property,
  type RootNode,
  type TemplateChildNode,
  createVNodeCall,
} from "./ast";
import type { TransformOptions } from "./options";
import { FRAGMENT, helperNameMap } from "./runtimeHelpers";

export type NodeTransform = (
  node: RootNode | TemplateChildNode,
  context: TransformContext,
) => void | (() => void) | (() => void)[];

export type DirectiveTransform = (
  dir: DirectiveNode,
  node: ElementNode,
  context: TransformContext,
  augmentor?: (ret: DirectiveTransformResult) => DirectiveTransformResult,
) => DirectiveTransformResult;

export interface DirectiveTransformResult {
  props: Property[];
}

export interface TransformContext extends Required<TransformOptions> {
  currentNode: RootNode | TemplateChildNode | null;
  parent: ParentNode | null;
  childIndex: number;
  helpers: Map<symbol, number>;
  identifiers: { [name: string]: number | undefined };
  helper<T extends symbol>(name: T): T;
  helperString(name: symbol): string;
  addIdentifiers(exp: string): void;
  removeIdentifiers(exp: string): void;
}

export function createTransformContext(
  root: RootNode,
  { nodeTransforms = [], directiveTransforms = {}, isBrowser = false }: TransformOptions,
): TransformContext {
  const context: TransformContext = {
    isBrowser,
    nodeTransforms,
    directiveTransforms,
    currentNode: root,
    parent: null,
    childIndex: 0,
    helpers: new Map(),
    identifiers: Object.create(null),
    helper(name) {
      const count = context.helpers.get(name) || 0;
      context.helpers.set(name, count + 1);
      return name;
    },
    helperString(name) {
      return `_${helperNameMap[context.helper(name)]}`;
    },
    addIdentifiers(exp) {
      if (!isBrowser) {
        addId(exp);
      }
    },
    removeIdentifiers(exp) {
      if (!isBrowser) {
        removeId(exp);
      }
    },
  };

  function addId(id: string) {
    const { identifiers } = context;
    if (identifiers[id] === undefined) {
      identifiers[id] = 0;
    }
    identifiers[id]!++;
  }

  function removeId(id: string) {
    context.identifiers[id]!--;
  }

  return context;
}

export function transform(root: RootNode, options: TransformOptions) {
  const context = createTransformContext(root, options);
  traverseNode(root, context);
  createRootCodegen(root, context);
  root.helpers = new Set([...context.helpers.keys()]);
}

function createRootCodegen(root: RootNode, context: TransformContext) {
  const { helper } = context;
  root.codegenNode = createVNodeCall(context, helper(FRAGMENT), undefined, root.children);
}

export function traverseNode(node: RootNode | TemplateChildNode, context: TransformContext) {
  context.currentNode = node;

  const { nodeTransforms } = context;
  const exitFns = [];
  for (let i = 0; i < nodeTransforms.length; i++) {
    const onExit = nodeTransforms[i](node, context);
    if (onExit) {
      if (isArray(onExit)) {
        exitFns.push(...onExit);
      } else {
        exitFns.push(onExit);
      }
    }
    if (!context.currentNode) {
      return;
    } else {
      node = context.currentNode;
    }
  }

  switch (node.type) {
    case NodeTypes.INTERPOLATION:
      break;
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      traverseChildren(node, context);
      break;
  }

  context.currentNode = node;
  let i = exitFns.length;
  while (i--) {
    exitFns[i]();
  }
}

export function traverseChildren(parent: ParentNode, context: TransformContext) {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (isString(child)) continue;
    context.parent = parent;
    context.childIndex = i;
    traverseNode(child, context);
  }
}
