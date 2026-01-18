import {
  type BlockStatement,
  type CallExpression,
  type CompilerOptions,
  ElementTypes,
  type IfStatement,
  type JSChildNode,
  NodeTypes,
  type RootNode,
  type TemplateChildNode,
  type TemplateLiteral,
  createBlockStatement,
  createCallExpression,
  createTemplateLiteral,
} from "@chibivue/compiler-core";
import { escapeHtml, isString } from "@chibivue/shared";
import { SSR_INTERPOLATE, ssrHelpers } from "./runtimeHelpers";
import { ssrProcessElement } from "./transforms/ssrTransformElement";
import { ssrProcessComponent } from "./transforms/ssrTransformComponent";
import { ssrProcessIf } from "./transforms/ssrVIf";
import { ssrProcessFor } from "./transforms/ssrVFor";

export interface SSRTransformContext {
  root: RootNode;
  options: CompilerOptions;
  body: (JSChildNode | IfStatement)[];
  helpers: Set<symbol>;
  onError: (error: Error) => void;
  helper<T extends symbol>(name: T): T;
  pushStringPart(part: TemplateLiteral["elements"][0]): void;
  pushStatement(statement: IfStatement | CallExpression): void;
}

function createSSRTransformContext(
  root: RootNode,
  options: CompilerOptions,
  helpers: Set<symbol> = new Set(),
): SSRTransformContext {
  const body: BlockStatement["body"] = [];
  let currentString: TemplateLiteral | null = null;

  return {
    root,
    options,
    body,
    helpers,
    onError: (e: Error) => {
      throw e;
    },
    helper<T extends symbol>(name: T): T {
      helpers.add(name);
      return name;
    },
    pushStringPart(part) {
      if (!currentString) {
        const currentCall = createCallExpression(`_push`);
        body.push(currentCall);
        currentString = createTemplateLiteral([]);
        currentCall.arguments.push(currentString);
      }
      const bufferedElements = currentString.elements;
      const lastItem = bufferedElements[bufferedElements.length - 1];
      if (isString(part) && isString(lastItem)) {
        bufferedElements[bufferedElements.length - 1] += part;
      } else {
        bufferedElements.push(part);
      }
    },
    pushStatement(statement) {
      // close current string
      currentString = null;
      body.push(statement);
    },
  };
}

export function createChildContext(
  parent: SSRTransformContext,
): SSRTransformContext {
  return createSSRTransformContext(parent.root, parent.options, parent.helpers);
}

export function ssrCodegenTransform(
  ast: RootNode,
  options: CompilerOptions,
): void {
  const context = createSSRTransformContext(ast, options);

  const isFragment =
    ast.children.length > 1 &&
    ast.children.some((c) => c.type !== NodeTypes.TEXT);
  processChildren(ast, context, isFragment);
  ast.codegenNode = createBlockStatement(context.body);

  // Finalize helpers
  ast.ssrHelpers = Array.from(
    new Set([
      ...Array.from(ast.helpers).filter((h) => h in ssrHelpers),
      ...context.helpers,
    ]),
  );

  ast.helpers = new Set(
    Array.from(ast.helpers).filter((h) => !(h in ssrHelpers)),
  );
}

interface Container {
  children: TemplateChildNode[];
}

export function processChildren(
  parent: Container,
  context: SSRTransformContext,
  asFragment = false,
): void {
  if (asFragment) {
    context.pushStringPart(`<!--[-->`);
  }
  const { children } = parent;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    switch (child.type) {
      case NodeTypes.ELEMENT:
        switch (child.tagType) {
          case ElementTypes.ELEMENT:
            ssrProcessElement(child, context);
            break;
          case ElementTypes.COMPONENT:
            ssrProcessComponent(child, context, parent);
            break;
          case ElementTypes.TEMPLATE:
            // process children
            processChildren(child, context);
            break;
        }
        break;
      case NodeTypes.TEXT:
        context.pushStringPart(escapeHtml(child.content));
        break;
      case NodeTypes.COMMENT:
        context.pushStringPart(`<!--${child.content}-->`);
        break;
      case NodeTypes.INTERPOLATION:
        context.pushStringPart(
          createCallExpression(context.helper(SSR_INTERPOLATE), [child.content]),
        );
        break;
      case NodeTypes.IF:
        ssrProcessIf(child, context);
        break;
      case NodeTypes.FOR:
        ssrProcessFor(child, context);
        break;
      case NodeTypes.IF_BRANCH:
        // no-op - handled by ssrProcessIf
        break;
    }
  }
  if (asFragment) {
    context.pushStringPart(`<!--]-->`);
  }
}

export function processChildrenAsStatement(
  parent: Container,
  parentContext: SSRTransformContext,
  asFragment = false,
): BlockStatement {
  const childContext = createChildContext(parentContext);
  processChildren(parent, childContext, asFragment);
  return createBlockStatement(childContext.body);
}
