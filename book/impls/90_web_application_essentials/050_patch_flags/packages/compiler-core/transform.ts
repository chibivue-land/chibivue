import { isArray, isString } from "../shared";
import {
  ConstantTypes,
  type DirectiveNode,
  type ElementNode,
  type ExpressionNode,
  type JSChildNode,
  NodeTypes,
  type ParentNode,
  type Property,
  type RootNode,
  type SimpleExpressionNode,
  type TemplateChildNode,
  createSimpleExpression,
  createVNodeCall,
} from "./ast";
import type { TransformOptions } from "./options";
import { CREATE_COMMENT, FRAGMENT, helperNameMap } from "./runtimeHelpers";

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

export type StructuralDirectiveTransform = (
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
) => void | (() => void);

export interface TransformContext extends Required<TransformOptions> {
  currentNode: RootNode | TemplateChildNode | null;
  parent: ParentNode | null;
  childIndex: number;
  root: RootNode;
  helpers: Map<symbol, number>;
  components: Set<string>;
  identifiers: { [name: string]: number | undefined };
  hoists: (JSChildNode | null)[];
  helper<T extends symbol>(name: T): T;
  helperString(name: symbol): string;
  hoist(exp: string | JSChildNode): SimpleExpressionNode;
  addIdentifiers(exp: ExpressionNode | string): void;
  removeIdentifiers(exp: ExpressionNode | string): void;
  replaceNode(node: TemplateChildNode): void;
  removeNode(node?: TemplateChildNode): void;
  onNodeRemoved(): void;
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
    root,
    helpers: new Map(),
    components: new Set(),
    identifiers: Object.create(null),
    hoists: [],
    helper(name) {
      const count = context.helpers.get(name) || 0;
      context.helpers.set(name, count + 1);
      return name;
    },
    helperString(name) {
      return `_${helperNameMap[context.helper(name)]}`;
    },
    hoist(exp) {
      if (isString(exp)) exp = createSimpleExpression(exp);
      context.hoists.push(exp);
      const identifier = createSimpleExpression(
        `_hoisted_${context.hoists.length}`,
        false,
        exp.loc,
        ConstantTypes.CAN_HOIST,
      );
      identifier.hoisted = exp;
      return identifier;
    },
    addIdentifiers(exp) {
      if (!isBrowser) {
        if (isString(exp)) {
          addId(exp);
        } else if (exp.identifiers) {
          exp.identifiers.forEach(addId);
        } else if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
          addId(exp.content);
        }
      }
    },
    removeIdentifiers(exp) {
      if (!isBrowser) {
        if (isString(exp)) {
          removeId(exp);
        } else if (exp.identifiers) {
          exp.identifiers.forEach(removeId);
        } else if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
          removeId(exp.content);
        }
      }
    },
    replaceNode(node) {
      context.parent!.children[context.childIndex] = context.currentNode = node;
    },
    removeNode(node) {
      const list = context.parent!.children;
      const removalIndex = node
        ? list.indexOf(node)
        : context.currentNode
          ? context.childIndex
          : -1;
      if (!node || node === context.currentNode) {
        // current node removed
        context.currentNode = null;
        context.onNodeRemoved();
      } else {
        // sibling node removed
        if (context.childIndex > removalIndex) {
          context.childIndex--;
          context.onNodeRemoved();
        }
      }
      context.parent!.children.splice(removalIndex, 1);
    },
    onNodeRemoved: () => {},
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
  if (options.hoistStatic) {
    hoistStatic(root, context);
  }
  createRootCodegen(root, context);
  root.helpers = new Set([...context.helpers.keys()]);
  root.components = [...context.components];
  root.hoists = context.hoists;
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
    case NodeTypes.COMMENT:
      context.helper(CREATE_COMMENT);
      break;
    case NodeTypes.INTERPOLATION:
      break;
    case NodeTypes.IF:
      for (let i = 0; i < node.branches.length; i++) {
        traverseNode(node.branches[i], context);
      }
      break;
    case NodeTypes.IF_BRANCH:
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
    case NodeTypes.FOR:
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
  let i = 0;
  const nodeRemoved = () => {
    i--;
  };
  for (; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (isString(child)) continue;
    context.parent = parent;
    context.childIndex = i;
    context.onNodeRemoved = nodeRemoved;
    traverseNode(child, context);
  }
}

function hoistStatic(root: RootNode, context: TransformContext) {
  walk(
    root,
    context,
    // Root node is already transformed
    isSingleElementRoot(root, root.children[0]),
  );
}

function isSingleElementRoot(
  root: RootNode,
  child: TemplateChildNode,
): child is ElementNode {
  return (
    root.children.length === 1 &&
    child.type === NodeTypes.ELEMENT
  );
}

function walk(
  node: ParentNode,
  context: TransformContext,
  doNotHoistNode: boolean = false,
) {
  const { children } = node;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    // only plain elements are eligible for hoisting
    if (
      child.type === NodeTypes.ELEMENT &&
      child.tagType === ElementTypes.ELEMENT
    ) {
      const constantType = doNotHoistNode
        ? ConstantTypes.NOT_CONSTANT
        : getConstantType(child, context);

      if (constantType > ConstantTypes.NOT_CONSTANT) {
        if (constantType >= ConstantTypes.CAN_HOIST) {
          (child.codegenNode as any).patchFlag = -1 /* HOISTED */;
          child.codegenNode = context.hoist(child.codegenNode!);
          continue;
        }
      }
    }

    // walk further
    if (child.type === NodeTypes.ELEMENT) {
      walk(child, context);
    } else if (child.type === NodeTypes.FOR) {
      // Do not hoist v-for single child
      walk(child, context, child.children.length === 1);
    } else if (child.type === NodeTypes.IF) {
      for (let i = 0; i < child.branches.length; i++) {
        walk(
          child.branches[i],
          context,
          child.branches[i].children.length === 1,
        );
      }
    }
  }
}

function getConstantType(
  node: TemplateChildNode,
  context: TransformContext,
): ConstantTypes {
  const { constantCache } = context as any;
  switch (node.type) {
    case NodeTypes.ELEMENT:
      if (node.tagType !== ElementTypes.ELEMENT) {
        return ConstantTypes.NOT_CONSTANT;
      }
      const cached = constantCache?.get(node);
      if (cached !== undefined) {
        return cached;
      }
      const codegenNode = node.codegenNode!;
      if (codegenNode.type !== NodeTypes.VNODE_CALL) {
        return ConstantTypes.NOT_CONSTANT;
      }
      // has dynamic props
      const flag = getPatchFlag(codegenNode);
      if (!flag) {
        let returnType = ConstantTypes.CAN_STRINGIFY;

        // check children
        for (let i = 0; i < node.children.length; i++) {
          const childType = getConstantType(node.children[i], context);
          if (childType === ConstantTypes.NOT_CONSTANT) {
            constantCache?.set(node, ConstantTypes.NOT_CONSTANT);
            return ConstantTypes.NOT_CONSTANT;
          }
          if (childType < returnType) {
            returnType = childType;
          }
        }

        // check props
        for (let i = 0; i < node.props.length; i++) {
          const p = node.props[i];
          if (p.type === NodeTypes.DIRECTIVE) {
            constantCache?.set(node, ConstantTypes.NOT_CONSTANT);
            return ConstantTypes.NOT_CONSTANT;
          }
        }

        if (returnType > ConstantTypes.CAN_SKIP_PATCH) {
          constantCache?.set(node, returnType);
          return returnType;
        } else {
          constantCache?.set(node, ConstantTypes.CAN_SKIP_PATCH);
          return ConstantTypes.CAN_SKIP_PATCH;
        }
      } else {
        constantCache?.set(node, ConstantTypes.NOT_CONSTANT);
        return ConstantTypes.NOT_CONSTANT;
      }
    case NodeTypes.TEXT:
    case NodeTypes.COMMENT:
      return ConstantTypes.CAN_STRINGIFY;
    case NodeTypes.IF:
    case NodeTypes.FOR:
      return ConstantTypes.NOT_CONSTANT;
    case NodeTypes.INTERPOLATION:
      return ConstantTypes.NOT_CONSTANT;
    default:
      return ConstantTypes.NOT_CONSTANT;
  }
}

function getPatchFlag(node: any): number | undefined {
  const flag = node.patchFlag;
  return flag ? parseInt(flag, 10) : undefined;
}

import { ElementTypes } from "./ast";

export function createStructuralDirectiveTransform(
  name: string | RegExp,
  fn: StructuralDirectiveTransform,
): NodeTransform {
  const matches = isString(name) ? (n: string) => n === name : (n: string) => name.test(n);

  return (node, context) => {
    if (node.type === NodeTypes.ELEMENT) {
      const { props } = node;
      const exitFns = [];
      for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
          props.splice(i, 1);
          i--;
          const onExit = fn(node, prop, context);
          if (onExit) exitFns.push(onExit);
        }
      }
      return exitFns;
    }
  };
}
