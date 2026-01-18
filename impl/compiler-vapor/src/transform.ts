import {
  type RootNode,
  type TemplateChildNode,
  type ElementNode,
  type SimpleExpressionNode,
  type DirectiveNode,
  type InterpolationNode,
  type TextNode,
  NodeTypes,
} from "@chibivue/compiler-core";

import {
  type RootIRNode,
  type BlockIRNode,
  type OperationNode,
  type IREffect,
  IRNodeTypes,
  DynamicFlag,
  createRootIR,
  createBlock,
} from "./ir";

export interface TransformContext {
  root: RootIRNode;
  block: BlockIRNode;
  template: string;
  elementCount: number;
  reference(): number;
  registerEffect(expressions: SimpleExpressionNode[], operations: OperationNode[]): void;
  registerOperation(...operations: OperationNode[]): void;
  enterBlock(block: BlockIRNode): () => void;
}

function createTransformContext(ir: RootIRNode): TransformContext {
  let currentBlock = ir.block;
  let elementCount = 0;

  const context: TransformContext = {
    root: ir,
    get block() {
      return currentBlock;
    },
    template: "",
    elementCount: 0,

    reference(): number {
      return elementCount++;
    },

    registerEffect(expressions: SimpleExpressionNode[], operations: OperationNode[]): void {
      // Filter out constant expressions
      const reactiveExpressions = expressions.filter((exp) => !isConstantExpression(exp));

      // If no reactive deps, register as operation
      if (reactiveExpressions.length === 0) {
        context.registerOperation(...operations);
        return;
      }

      // Register as effect with dependencies
      currentBlock.effect.push({
        expressions: reactiveExpressions,
        operations,
      });
    },

    registerOperation(...operations: OperationNode[]): void {
      currentBlock.operation.push(...operations);
    },

    enterBlock(block: BlockIRNode): () => void {
      const parent = currentBlock;
      currentBlock = block;
      return () => {
        currentBlock = parent;
      };
    },
  };

  return context;
}

function isConstantExpression(exp: SimpleExpressionNode): boolean {
  return exp.isStatic;
}

export function transform(ast: RootNode, source: string): RootIRNode {
  const ir = createRootIR(ast, source);
  const context = createTransformContext(ir);

  // Transform children
  transformChildren(ast.children, context);

  // Store template
  ir.template.push(context.template);

  return ir;
}

function transformChildren(children: TemplateChildNode[], context: TransformContext): void {
  for (const child of children) {
    transformNode(child, context);
  }
}

function transformNode(node: TemplateChildNode, context: TransformContext): void {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      transformElement(node as ElementNode, context);
      break;
    case NodeTypes.TEXT:
      transformText(node as TextNode, context);
      break;
    case NodeTypes.INTERPOLATION:
      transformInterpolation(node as InterpolationNode, context);
      break;
  }
}

function transformElement(node: ElementNode, context: TransformContext): void {
  const elementId = context.reference();

  // Start tag
  context.template += `<${node.tag}`;

  // Process props and directives
  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      // Static attribute
      context.template += ` ${prop.name}="${prop.value?.content || ""}"`;
    } else if (prop.type === NodeTypes.DIRECTIVE) {
      transformDirective(prop, elementId, node, context);
    }
  }

  context.template += `>`;

  // Process children
  transformChildren(node.children, context);

  // Close tag (for non-void elements)
  const voidElements = ["br", "hr", "img", "input", "meta", "link", "area", "base", "col"];
  if (!voidElements.includes(node.tag)) {
    context.template += `</${node.tag}>`;
  }

  // Mark for return
  context.block.returns.push(elementId);
}

function transformDirective(
  dir: DirectiveNode,
  elementId: number,
  node: ElementNode,
  context: TransformContext,
): void {
  switch (dir.name) {
    case "on":
      transformVOn(dir, elementId, context);
      break;
    case "bind":
      transformVBind(dir, elementId, context);
      break;
  }
}

function transformVOn(dir: DirectiveNode, elementId: number, context: TransformContext): void {
  if (!dir.arg || !dir.exp) return;

  const eventName = (dir.arg as SimpleExpressionNode).content;

  // Events are always registered as operations (not effects)
  // because the handler itself doesn't need reactive tracking
  context.registerOperation({
    type: IRNodeTypes.SET_EVENT,
    element: elementId,
    key: eventName,
    value: dir.exp as SimpleExpressionNode,
    modifiers: dir.modifiers,
  });
}

function transformVBind(dir: DirectiveNode, elementId: number, context: TransformContext): void {
  if (!dir.arg || !dir.exp) return;

  const propName = (dir.arg as SimpleExpressionNode).content;

  // Register as effect for reactive props
  context.registerEffect(
    [dir.exp as SimpleExpressionNode],
    [
      {
        type: IRNodeTypes.SET_PROP,
        element: elementId,
        key: propName,
        value: dir.exp as SimpleExpressionNode,
      },
    ],
  );
}

function transformText(node: TextNode, context: TransformContext): void {
  context.template += node.content;
}

function transformInterpolation(node: InterpolationNode, context: TransformContext): void {
  const elementId = context.reference();

  // Add placeholder comment
  context.template += `<!---->`;

  // Register effect for text update
  context.registerEffect(
    [node.content as SimpleExpressionNode],
    [
      {
        type: IRNodeTypes.SET_TEXT,
        element: elementId,
        values: [node.content as SimpleExpressionNode],
      },
    ],
  );
}
