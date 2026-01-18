import type { SimpleExpressionNode, RootNode } from "@chibivue/compiler-core";

import type {
  RootIRNode,
  BlockIRNode,
  OperationNode,
  SetTextIRNode,
  SetEventIRNode,
  SetPropIRNode,
  IfIRNode,
  ForIRNode,
} from "./ir";
import { IRNodeTypes } from "./ir";

export interface VaporCodegenResult {
  code: string;
  preamble: string;
  ast: RootNode;
}

export interface VaporCodegenOptions {
  isBrowser?: boolean;
  inline?: boolean;
}

interface VaporCodegenContext {
  code: string;
  indentLevel: number;
  push(code: string): void;
  indent(): void;
  deindent(): void;
  newline(): void;
}

function createVaporCodegenContext(): VaporCodegenContext {
  const context: VaporCodegenContext = {
    code: "",
    indentLevel: 0,
    push(code: string) {
      context.code += code;
    },
    indent() {
      context.indentLevel++;
      context.newline();
    },
    deindent() {
      context.indentLevel--;
      context.newline();
    },
    newline() {
      context.push("\n" + "  ".repeat(context.indentLevel));
    },
  };
  return context;
}

export function generateVaporFromIR(
  ir: RootIRNode,
  options: VaporCodegenOptions = {},
): VaporCodegenResult {
  const context = createVaporCodegenContext();
  const { push, indent, deindent, newline } = context;
  const isSetupInlined = !options.isBrowser && !!options.inline;

  // Generate preamble
  const preambleContext = isSetupInlined ? createVaporCodegenContext() : context;
  genVaporPreamble(preambleContext, options.isBrowser);

  // Generate component function
  push(`((_self) => {`);
  indent();

  // Generate template call
  const template = ir.template[0] || "";
  push(`const _root = _template(\`${template}\`);`);
  newline();

  // Generate element references
  const block = ir.block;
  const elementCount = countElements(block);

  for (let i = 0; i < elementCount; i++) {
    push(`const _el${i} = _root${generateElementPath(i, elementCount)};`);
    newline();
  }

  // Generate operations (non-reactive)
  for (const op of block.operation) {
    genOperation(op, context);
  }

  // Generate effects (reactive)
  for (const effect of block.effect) {
    push(`_renderEffect(() => {`);
    indent();
    for (const op of effect.operations) {
      genOperation(op, context);
    }
    deindent();
    push(`});`);
    newline();
  }

  // Return root element
  push(`return _root;`);
  deindent();
  push(`})`);

  return {
    code: context.code,
    preamble: isSetupInlined ? preambleContext.code : "",
    ast: ir.node,
  };
}

function genVaporPreamble(context: VaporCodegenContext, isBrowser?: boolean) {
  const { push, newline } = context;

  if (isBrowser) {
    push(
      `const { template: _template, setText: _setText, on: _on, setClass: _setClass, setStyle: _setStyle, setAttr: _setAttr, renderEffect: _renderEffect } = ChibiVueVapor`,
    );
    newline();
    push(`return `);
  } else {
    push(
      `import { template as _template, setText as _setText, on as _on, setClass as _setClass, setStyle as _setStyle, setAttr as _setAttr, renderEffect as _renderEffect } from "@chibivue/runtime-vapor"`,
    );
    newline();
    newline();
  }
}

function genOperation(op: OperationNode, context: VaporCodegenContext): void {
  const { push, newline } = context;

  switch (op.type) {
    case IRNodeTypes.SET_TEXT:
      genSetText(op, context);
      break;
    case IRNodeTypes.SET_EVENT:
      genSetEvent(op, context);
      break;
    case IRNodeTypes.SET_PROP:
      genSetProp(op, context);
      break;
    case IRNodeTypes.IF:
      genIf(op, context);
      break;
    case IRNodeTypes.FOR:
      genFor(op, context);
      break;
  }
}

function genSetText(op: SetTextIRNode, context: VaporCodegenContext): void {
  const { push, newline } = context;
  const values = op.values.map((v) => genExpression(v)).join(", ");
  push(`_setText(_el${op.element}, "", ${values});`);
  newline();
}

function genSetEvent(op: SetEventIRNode, context: VaporCodegenContext): void {
  const { push, newline } = context;
  const modifiersArg = op.modifiers?.length ? `, ${JSON.stringify(op.modifiers)}` : "";
  push(`_on(_el${op.element}, "${op.key}", ${genExpression(op.value)}${modifiersArg});`);
  newline();
}

function genSetProp(op: SetPropIRNode, context: VaporCodegenContext): void {
  const { push, newline } = context;
  const key = op.key;
  const value = genExpression(op.value);

  if (key === "class") {
    push(`_setClass(_el${op.element}, ${value});`);
  } else if (key === "style") {
    push(`_setStyle(_el${op.element}, ${value});`);
  } else {
    push(`_setAttr(_el${op.element}, "${key}", ${value});`);
  }
  newline();
}

function genIf(op: IfIRNode, context: VaporCodegenContext): void {
  const { push, indent, deindent, newline } = context;
  // TODO: Implement v-if code generation
  push(`// TODO: v-if (id: ${op.id})`);
  newline();
}

function genFor(op: ForIRNode, context: VaporCodegenContext): void {
  const { push, newline } = context;
  // TODO: Implement v-for code generation
  push(`// TODO: v-for (id: ${op.id})`);
  newline();
}

function genExpression(exp: SimpleExpressionNode): string {
  return exp.content;
}

function countElements(block: BlockIRNode): number {
  let count = block.returns.length;
  // Also count elements referenced in operations and effects
  for (const op of block.operation) {
    if ("element" in op && typeof op.element === "number") {
      count = Math.max(count, op.element + 1);
    }
  }
  for (const effect of block.effect) {
    for (const op of effect.operations) {
      if ("element" in op && typeof op.element === "number") {
        count = Math.max(count, op.element + 1);
      }
    }
  }
  return count;
}

function generateElementPath(index: number, total: number): string {
  if (total <= 1) return "";
  if (index === 0) return ".firstChild";
  return `.childNodes[${index}]`;
}

// Legacy function for backward compatibility
export function generateVapor(
  ast: RootNode,
  options: VaporCodegenOptions = {},
): VaporCodegenResult {
  const context = createVaporCodegenContext();
  const { push, indent, deindent, newline } = context;
  const isSetupInlined = !options.isBrowser && !!options.inline;

  // Analyze template and collect info
  const templateInfo = analyzeTemplate(ast);

  // Generate preamble
  const preambleContext = isSetupInlined ? createVaporCodegenContext() : context;
  genVaporPreambleLegacy(preambleContext, options.isBrowser);

  // Generate component function
  push(`((_self) => {`);
  indent();

  // Generate template call
  push(`const _root = _template(\`${templateInfo.html}\`);`);
  newline();

  // Generate element references
  for (const ref of templateInfo.refs) {
    push(`const ${ref.varName} = ${ref.path};`);
    newline();
  }

  // Generate effects for dynamic bindings
  for (const binding of templateInfo.bindings) {
    if (binding.type === "text") {
      push(`_renderEffect(() => {`);
      indent();
      push(`_setText(${binding.target}, "", ${binding.expression});`);
      deindent();
      push(`});`);
      newline();
    } else if (binding.type === "event") {
      push(`_on(${binding.target}, "${binding.event}", ${binding.expression});`);
      newline();
    }
  }

  // Return root element
  push(`return _root;`);
  deindent();
  push(`})`);

  return {
    code: context.code,
    preamble: isSetupInlined ? preambleContext.code : "",
    ast,
  };
}

function genVaporPreambleLegacy(context: VaporCodegenContext, isBrowser?: boolean) {
  const { push, newline } = context;

  if (isBrowser) {
    push(
      `const { template: _template, setText: _setText, on: _on, renderEffect: _renderEffect } = ChibiVueVapor`,
    );
    newline();
    push(`return `);
  } else {
    push(
      `import { template as _template, setText as _setText, on as _on, renderEffect as _renderEffect } from "@chibivue/runtime-vapor"`,
    );
    newline();
    newline();
  }
}

import { NodeTypes, type TextNode, type ElementNode, type InterpolationNode, type DirectiveNode, type TemplateChildNode } from "@chibivue/compiler-core";

interface TemplateRef {
  varName: string;
  path: string;
}

interface TemplateBinding {
  type: "text" | "event";
  target: string;
  expression: string;
  event?: string;
}

interface TemplateAnalysis {
  html: string;
  refs: TemplateRef[];
  bindings: TemplateBinding[];
}

function analyzeTemplate(ast: RootNode): TemplateAnalysis {
  const refs: TemplateRef[] = [];
  const bindings: TemplateBinding[] = [];
  let refCounter = 0;

  function generatePath(indices: number[]): string {
    if (indices.length === 0) return "_root";
    let path = "_root";
    for (let i = 0; i < indices.length; i++) {
      if (i === 0) {
        path += indices[i] === 0 ? ".firstChild" : `.childNodes[${indices[i]}]`;
      } else {
        path += indices[i] === 0 ? ".firstChild" : `.childNodes[${indices[i]}]`;
      }
    }
    return path;
  }

  function processNode(node: TemplateChildNode, parentPath: number[]): string {
    if (node.type === NodeTypes.TEXT) {
      return (node as TextNode).content;
    }

    if (node.type === NodeTypes.INTERPOLATION) {
      const interp = node as InterpolationNode;
      const varName = `_el${refCounter++}`;
      const path = generatePath(parentPath);

      refs.push({ varName, path });
      bindings.push({
        type: "text",
        target: varName,
        expression: (interp.content as SimpleExpressionNode).content,
      });

      return `<!---->`; // placeholder comment
    }

    if (node.type === NodeTypes.ELEMENT) {
      const el = node as ElementNode;
      let html = `<${el.tag}`;

      // Process attributes and directives
      for (const prop of el.props) {
        if (prop.type === NodeTypes.ATTRIBUTE) {
          html += ` ${prop.name}="${prop.value?.content || ""}"`;
        } else if (prop.type === NodeTypes.DIRECTIVE) {
          const dir = prop as DirectiveNode;
          if (dir.name === "on" && dir.arg && dir.exp) {
            const varName = `_el${refCounter++}`;
            const fullPath = generatePath(parentPath);
            refs.push({ varName, path: fullPath });
            bindings.push({
              type: "event",
              target: varName,
              event: (dir.arg as SimpleExpressionNode).content,
              expression: (dir.exp as SimpleExpressionNode).content,
            });
          }
        }
      }

      html += `>`;

      // Process children
      for (let i = 0; i < el.children.length; i++) {
        const childPath = [...parentPath, i];
        html += processNode(el.children[i], childPath);
      }

      // Close tag (for non-void elements)
      const voidElements = ["br", "hr", "img", "input", "meta", "link"];
      if (!voidElements.includes(el.tag)) {
        html += `</${el.tag}>`;
      }

      return html;
    }

    return "";
  }

  // Process all root children
  let html = "";
  for (let i = 0; i < ast.children.length; i++) {
    html += processNode(ast.children[i], [i]);
  }

  return { html, refs, bindings };
}
