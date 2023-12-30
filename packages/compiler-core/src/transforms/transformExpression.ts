import { parse } from "@babel/parser";
import { Identifier, Node } from "@babel/types";
import { genPropsAccessExp, hasOwn, makeMap } from "@chibivue/shared";

import {
  NodeTypes,
  SimpleExpressionNode,
  ExpressionNode,
  CompoundExpressionNode,
  createSimpleExpression,
  createCompoundExpression,
} from "../ast";
import { walkIdentifiers } from "../babelUtils";
import { NodeTransform, TransformContext } from "../transform";
import { advancePositionWithClone, isSimpleIdentifier } from "../utils";
import { BindingTypes } from "../options";
import { UNREF } from "../runtimeHelpers";

const isLiteralWhitelisted = makeMap("true,false,null,this");

export const transformExpression: NodeTransform = (node, ctx) => {
  if (node.type === NodeTypes.INTERPOLATION) {
    node.content = processExpression(node.content as SimpleExpressionNode, ctx);
  } else if (node.type === NodeTypes.ELEMENT) {
    for (let i = 0; i < node.props.length; i++) {
      const dir = node.props[i];
      if (dir.type === NodeTypes.DIRECTIVE && dir.name !== "for") {
        const exp = dir.exp;
        const arg = dir.arg;
        if (
          exp &&
          exp.type === NodeTypes.SIMPLE_EXPRESSION &&
          !(dir.name === "on" && arg)
        ) {
          dir.exp = processExpression(exp, ctx);
        }
        if (arg && arg.type === NodeTypes.SIMPLE_EXPRESSION && !arg.isStatic) {
          dir.arg = processExpression(arg, ctx);
        }
      }
    }
  }
};

interface PrefixMeta {
  start: number;
  end: number;
}

export function processExpression(
  node: SimpleExpressionNode,
  ctx: TransformContext,
  asParams = false
): ExpressionNode {
  if (ctx.isBrowser) {
    return node;
  }

  const rawExp = node.content;

  const { inline, bindingMetadata } = ctx;

  const rewriteIdentifier = (raw: string, parent?: Node, id?: Identifier) => {
    const type = hasOwn(bindingMetadata, raw) && bindingMetadata[raw];
    // x = y
    const isAssignmentLVal =
      parent && parent.type === "AssignmentExpression" && parent.left === id;
    // x++
    const isUpdateArg =
      parent && parent.type === "UpdateExpression" && parent.argument === id;

    if (inline) {
      if (type === BindingTypes.SETUP_CONST) {
        return raw;
      } else if (type === BindingTypes.SETUP_REACTIVE_CONST) {
        return raw;
      } else if (type === BindingTypes.SETUP_REF) {
        return `${raw}.value`;
      } else if (type === BindingTypes.SETUP_MAYBE_REF) {
        return isAssignmentLVal || isUpdateArg
          ? `${raw}.value`
          : `${ctx.helperString(UNREF)}(${raw})`;
      } else if (type === BindingTypes.PROPS) {
        return genPropsAccessExp(raw);
      }
    }

    return `_ctx.${raw}`;
  };

  if (isSimpleIdentifier(rawExp)) {
    const isLiteral = isLiteralWhitelisted(rawExp);
    const isScopeVarReference = ctx.identifiers[rawExp];
    if (!asParams && !isScopeVarReference && !isLiteral) {
      node.content = rewriteIdentifier(rawExp);
    }
    return node;
  }

  const source = `(${rawExp})${asParams ? `=>{}` : ``}`;
  const ast = parse(source).program;
  type QualifiedId = Identifier & PrefixMeta;
  const ids: QualifiedId[] = [];
  const parentStack: Node[] = [];
  const knownIds: Record<string, number> = Object.create(ctx.identifiers);

  walkIdentifiers(
    ast,
    (node) => {
      node.name = rewriteIdentifier(node.name);
      ids.push(node as QualifiedId);
    },
    knownIds,
    parentStack
  );

  const children: CompoundExpressionNode["children"] = [];
  ids.sort((a, b) => a.start - b.start);
  ids.forEach((id, i) => {
    const start = id.start - 1;
    const end = id.end - 1;
    const last = ids[i - 1];
    const leadingText = rawExp.slice(last ? last.end - 1 : 0, start);
    if (leadingText.length) {
      children.push(leadingText);
    }

    const source = rawExp.slice(start, end);
    children.push(
      createSimpleExpression(id.name, false, {
        source,
        start: advancePositionWithClone(node.loc.start, source, start),
        end: advancePositionWithClone(node.loc.start, source, end),
      })
    );
    if (i === ids.length - 1 && end < rawExp.length) {
      children.push(rawExp.slice(end));
    }
  });

  let ret;
  if (children.length) {
    ret = createCompoundExpression(children, node.loc);
  } else {
    ret = node;
  }

  ret.identifiers = Object.keys(knownIds);

  return ret;
}
