import { isArray, isString } from "@chibivue/shared";
import {
  type DirectiveNode,
  type ElementNode,
  type ExpressionNode,
  NodeTypes,
  type ParentNode,
  type Property,
  type RootNode,
  type TemplateChildNode,
  createVNodeCall,
} from "./ast";
import type { TransformOptions } from "./options";
import { CREATE_COMMENT, FRAGMENT, TO_DISPLAY_STRING, helperNameMap } from "./runtimeHelpers";

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
  needRuntime?: boolean | symbol;
}

export type StructuralDirectiveTransform = (
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
) => void | (() => void);

export interface TransformContext extends Required<TransformOptions> {
  helpers: Map<symbol, number>;
  components: Set<string>;
  currentNode: RootNode | TemplateChildNode | null;
  identifiers: { [name: string]: number | undefined };
  scopes: {
    vFor: number;
  };
  parent: ParentNode | null;
  childIndex: number;
  inline: boolean;
  helper<T extends symbol>(name: T): T;
  helperString(name: symbol): string;
  replaceNode(node: TemplateChildNode): void;
  removeNode(node?: TemplateChildNode): void;
  onNodeRemoved(): void;
  addIdentifiers(exp: ExpressionNode | string): void;
  removeIdentifiers(exp: ExpressionNode | string): void;
}

export function createTransformContext(
  root: RootNode,
  {
    nodeTransforms = [],
    directiveTransforms = {},
    inline = false,
    bindingMetadata = Object.create(null),
    isBrowser = false,
  }: TransformOptions,
): TransformContext {
  const context: TransformContext = {
    isBrowser,
    nodeTransforms,
    directiveTransforms,
    helpers: new Map(),
    components: new Set(),
    currentNode: root,
    identifiers: Object.create(null),
    scopes: {
      vFor: 0,
    },
    parent: null,
    childIndex: 0,
    bindingMetadata,
    inline,
    helper(name) {
      const count = context.helpers.get(name) || 0;
      context.helpers.set(name, count + 1);
      return name;
    },
    helperString(name) {
      return `_${helperNameMap[context.helper(name)]}`;
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
    addIdentifiers(exp) {
      if (isString(exp)) {
        addId(exp);
      } else if (exp.identifiers) {
        exp.identifiers.forEach(addId);
      } else if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
        addId(exp.content);
      }
    },
    removeIdentifiers(exp) {
      if (isString(exp)) {
        removeId(exp);
      } else if (exp.identifiers) {
        exp.identifiers.forEach(removeId);
      } else if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
        removeId(exp.content);
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

export function transform(root: RootNode, options: TransformOptions): void {
  const context = createTransformContext(root, options);
  traverseNode(root, context);
  createRootCodegen(root, context);
  root.components = [...context.components];
  root.helpers = new Set([...context.helpers.keys()]);
}

function createRootCodegen(root: RootNode, context: TransformContext) {
  const { helper } = context;
  root.codegenNode = createVNodeCall(context, helper(FRAGMENT), undefined, root.children);
}

export function traverseNode(node: RootNode | TemplateChildNode, context: TransformContext): void {
  context.currentNode = node;
  // apply transform plugins
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
      // node was removed
      return;
    } else {
      // node may have been replaced
      node = context.currentNode;
    }
  }

  switch (node.type) {
    case NodeTypes.COMMENT:
      context.helper(CREATE_COMMENT);
      break;
    case NodeTypes.INTERPOLATION: // no need to traverse, but we need to inject toString helper
      context.helper(TO_DISPLAY_STRING);
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

  // exit transforms
  context.currentNode = node;
  let i = exitFns.length;
  while (i--) {
    exitFns[i]();
  }
}

export function traverseChildren(parent: ParentNode, context: TransformContext): void {
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
