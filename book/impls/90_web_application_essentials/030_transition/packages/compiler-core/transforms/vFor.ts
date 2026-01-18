import {
  type DirectiveNode,
  type ElementNode,
  type ExpressionNode,
  type ForCodegenNode,
  type ForIteratorExpression,
  type ForNode,
  type ForRenderListExpression,
  NodeTypes,
  type SimpleExpressionNode,
  type SourceLocation,
  type VNodeCall,
  createCallExpression,
  createFunctionExpression,
  createSimpleExpression,
  createVNodeCall,
} from "../ast";
import { FRAGMENT, RENDER_LIST } from "../runtimeHelpers";
import { type TransformContext, createStructuralDirectiveTransform } from "../transform";
import { getInnerRange } from "../utils";
import { processExpression } from "./transformExpression";

export const transformFor = createStructuralDirectiveTransform("for", (node, dir, context) => {
  return processFor(node, dir, context, (forNode) => {
    const renderExp = createCallExpression(context.helper(RENDER_LIST), [
      forNode.source,
    ]) as ForRenderListExpression;

    forNode.codegenNode = createVNodeCall(
      context,
      context.helper(FRAGMENT),
      undefined,
      renderExp,
    ) as ForCodegenNode;

    return () => {
      const { children } = forNode;
      const childBlock = (children[0] as ElementNode).codegenNode as VNodeCall;

      renderExp.arguments.push(
        createFunctionExpression(
          createForLoopParams(forNode.parseResult),
          childBlock,
          true /* force newline */,
        ) as ForIteratorExpression,
      );
    };
  });
});

export function processFor(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (forNode: ForNode) => (() => void) | undefined,
) {
  const parseResult = parseForExpression(dir.exp as SimpleExpressionNode, context);

  const { addIdentifiers, removeIdentifiers } = context;

  const { source, value, key, index } = parseResult!;

  const forNode: ForNode = {
    type: NodeTypes.FOR,
    loc: dir.loc,
    source,
    valueAlias: value,
    keyAlias: key,
    parseResult: parseResult!,
    children: [node],
  };

  context.replaceNode(forNode);

  if (!context.isBrowser) {
    value && addIdentifiers(value);
    key && addIdentifiers(key);
    index && addIdentifiers(index);
  }

  const onExit = processCodegen && processCodegen(forNode);

  return () => {
    value && removeIdentifiers(value);
    key && removeIdentifiers(key);
    index && removeIdentifiers(index);

    if (onExit) onExit();
  };
}

const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/;
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/;
const stripParensRE = /^\(|\)$/g;

export interface ForParseResult {
  source: ExpressionNode;
  value: ExpressionNode | undefined;
  key: ExpressionNode | undefined;
  index: ExpressionNode | undefined;
}

export function parseForExpression(
  input: SimpleExpressionNode,
  context: TransformContext,
): ForParseResult | undefined {
  const loc = input.loc;
  const exp = input.content;
  const inMatch = exp.match(forAliasRE);

  if (!inMatch) return;

  const [, LHS, RHS] = inMatch;
  const result: ForParseResult = {
    source: createAliasExpression(loc, RHS.trim(), exp.indexOf(RHS, LHS.length)),
    value: undefined,
    key: undefined,
    index: undefined,
  };

  if (!context.isBrowser) {
    result.source = processExpression(result.source as SimpleExpressionNode, context);
  }

  let valueContent = LHS.trim().replace(stripParensRE, "").trim();
  const iteratorMatch = valueContent.match(forIteratorRE);
  const trimmedOffset = LHS.indexOf(valueContent);

  if (iteratorMatch) {
    valueContent = valueContent.replace(forIteratorRE, "").trim();
    const keyContent = iteratorMatch[1].trim();
    let keyOffset: number | undefined;
    if (keyContent) {
      keyOffset = exp.indexOf(keyContent, trimmedOffset + valueContent.length);
      result.key = createAliasExpression(loc, keyContent, keyOffset);
      if (!context.isBrowser) {
        result.key = processExpression(result.key, context, true);
      }
    }

    if (iteratorMatch[2]) {
      const indexContent = iteratorMatch[2].trim();
      if (indexContent) {
        result.index = createAliasExpression(
          loc,
          indexContent,
          exp.indexOf(
            indexContent,
            result.key ? keyOffset! + keyContent.length : trimmedOffset + valueContent.length,
          ),
        );
        if (!context.isBrowser) {
          result.index = processExpression(result.index, context, true);
        }
      }
    }
  }

  if (valueContent) {
    result.value = createAliasExpression(loc, valueContent, trimmedOffset);
    if (!context.isBrowser) {
      result.value = processExpression(result.value, context, true);
    }
  }

  return result;
}

function createAliasExpression(
  range: SourceLocation,
  content: string,
  offset: number,
): SimpleExpressionNode {
  return createSimpleExpression(content, false, getInnerRange(range, offset, content.length));
}

export function createForLoopParams(
  { value, key, index }: ForParseResult,
  memoArgs: ExpressionNode[] = [],
): ExpressionNode[] {
  return createParamsList([value, key, index, ...memoArgs]);
}

function createParamsList(args: (ExpressionNode | undefined)[]): ExpressionNode[] {
  let i = args.length;
  while (i--) {
    if (args[i]) break;
  }
  return args
    .slice(0, i + 1)
    .map((arg, i) => arg || createSimpleExpression(`_`.repeat(i + 1), false));
}
