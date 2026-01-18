import {
  type CallExpression,
  ElementTypes,
  type NodeTransform,
  NodeTypes,
  type PlainElementNode,
  type TemplateLiteral,
  createCallExpression,
  createTemplateLiteral,
} from "@chibivue/compiler-core";
import {
  escapeHtml,
  isBooleanAttr,
  isSSRSafeAttrName,
  propsToAttrMap,
  isVoidTag,
} from "@chibivue/shared";
import {
  SSR_INCLUDE_BOOLEAN_ATTR,
  SSR_RENDER_ATTR,
  SSR_RENDER_ATTRS,
  SSR_RENDER_CLASS,
  SSR_RENDER_DYNAMIC_ATTR,
  SSR_RENDER_STYLE,
} from "../runtimeHelpers";
import { type SSRTransformContext, processChildren } from "../ssrCodegenTransform";

export const ssrTransformElement: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ELEMENT || node.tagType !== ElementTypes.ELEMENT) {
    return;
  }

  return function ssrPostTransformElement() {
    const openTag: TemplateLiteral["elements"] = [`<${node.tag}`];

    // process props
    for (const prop of node.props) {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        if (prop.name === "key" || prop.name === "ref") {
          continue;
        }
        openTag.push(` ${prop.name}` + (prop.value ? `="${escapeHtml(prop.value.content)}"` : ``));
      } else if (prop.type === NodeTypes.DIRECTIVE) {
        // handle v-bind
        if (prop.name === "bind" && prop.arg && prop.exp) {
          const attrName =
            prop.arg.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic
              ? prop.arg.content
              : null;

          if (attrName) {
            if (attrName === "key" || attrName === "ref") {
              continue;
            }
            if (attrName === "class") {
              openTag.push(
                ` class="`,
                createCallExpression(context.helper(SSR_RENDER_CLASS), [prop.exp]),
                `"`,
              );
            } else if (attrName === "style") {
              openTag.push(
                ` style="`,
                createCallExpression(context.helper(SSR_RENDER_STYLE), [prop.exp]),
                `"`,
              );
            } else {
              const mappedName = propsToAttrMap[attrName] || attrName.toLowerCase();
              if (isBooleanAttr(mappedName)) {
                openTag.push(
                  createCallExpression(context.helper(SSR_INCLUDE_BOOLEAN_ATTR), [prop.exp]),
                );
              } else if (isSSRSafeAttrName(mappedName)) {
                openTag.push(
                  createCallExpression(context.helper(SSR_RENDER_ATTR), [prop.arg, prop.exp]),
                );
              }
            }
          } else {
            // dynamic attribute name
            openTag.push(
              createCallExpression(context.helper(SSR_RENDER_DYNAMIC_ATTR), [prop.arg!, prop.exp]),
            );
          }
        }
        // v-html
        else if (prop.name === "html" && prop.exp) {
          // handled in children
        }
        // v-text
        else if (prop.name === "text" && prop.exp) {
          // handled in children
        }
      }
    }

    node.ssrCodegenNode = createTemplateLiteral(openTag);
  };
};

export function ssrProcessElement(node: PlainElementNode, context: SSRTransformContext): void {
  const elementsToAdd = node.ssrCodegenNode!.elements;
  for (const element of elementsToAdd) {
    context.pushStringPart(element);
  }

  // close open tag
  context.pushStringPart(`>`);

  // handle v-html
  const vHtml = node.props.find((p) => p.type === NodeTypes.DIRECTIVE && p.name === "html");
  if (vHtml && vHtml.type === NodeTypes.DIRECTIVE && vHtml.exp) {
    context.pushStringPart(vHtml.exp);
  } else if (node.children.length) {
    // handle v-text
    const vText = node.props.find((p) => p.type === NodeTypes.DIRECTIVE && p.name === "text");
    if (vText && vText.type === NodeTypes.DIRECTIVE && vText.exp) {
      context.pushStringPart(createCallExpression(context.helper(SSR_RENDER_ATTRS), [vText.exp]));
    } else {
      processChildren(node, context);
    }
  }

  if (!isVoidTag(node.tag)) {
    context.pushStringPart(`</${node.tag}>`);
  }
}
