import {
  type ElementNode,
  type InterpolationNode,
  NodeTypes,
  type RootNode,
  type SimpleExpressionNode,
  type TemplateChildNode,
  type TextNode,
  type DirectiveNode,
} from "@chibivue/compiler-core";

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
  helpers: Set<symbol>;
  push(code: string): void;
  indent(): void;
  deindent(): void;
  newline(): void;
}

function createVaporCodegenContext(): VaporCodegenContext {
  const context: VaporCodegenContext = {
    code: "",
    indentLevel: 0,
    helpers: new Set(),
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

export function generateVapor(
  ast: RootNode,
  options: VaporCodegenOptions = {},
): VaporCodegenResult {
  const context = createVaporCodegenContext();
  const { push, indent, deindent, newline } = context;
  const isSetupInlined = !options.isBrowser && !!options.inline;

  // Analyze template and collect info
  const templateInfo = analyzeTemplate(ast, context);

  // Generate preamble
  const preambleContext = isSetupInlined ? createVaporCodegenContext() : context;
  genVaporPreamble(preambleContext, options.isBrowser);

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
      push(`_effect(() => {`);
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

function genVaporPreamble(context: VaporCodegenContext, isBrowser?: boolean) {
  const { push, newline } = context;

  if (isBrowser) {
    push(`const { template: _template, setText: _setText, on: _on } = ChibiVueVapor`);
    newline();
    push(`const { effect: _effect } = ChibiVue`);
    newline();
    push(`return `);
  } else {
    push(
      `import { template as _template, setText as _setText, on as _on } from "@chibivue/runtime-vapor"`,
    );
    newline();
    push(`import { effect as _effect } from "chibivue"`);
    newline();
    newline();
  }
}

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

function analyzeTemplate(ast: RootNode, context: VaporCodegenContext): TemplateAnalysis {
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
