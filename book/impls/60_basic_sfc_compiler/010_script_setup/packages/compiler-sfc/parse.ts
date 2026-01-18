import { type ElementNode, NodeTypes, type SourceLocation } from "../compiler-core";
import * as CompilerDOM from "../compiler-dom";
import type { TemplateCompiler } from "./compileTemplate";

export interface SFCDescriptor {
  id: string;
  filename: string;
  source: string;
  template: SFCTemplateBlock | null;
  script: SFCScriptBlock | null;
  scriptSetup: SFCScriptBlock | null;
  styles: SFCStyleBlock[];
}

export interface SFCBlock {
  type: string;
  content: string;
  loc: SourceLocation;
}

export interface SFCTemplateBlock extends SFCBlock {
  type: "template";
}

export interface SFCScriptBlock extends SFCBlock {
  type: "script";
  setup?: boolean;
}

export declare interface SFCStyleBlock extends SFCBlock {
  type: "style";
}

export interface SFCParseOptions {
  filename?: string;
  sourceRoot?: string;
  compiler?: TemplateCompiler;
}

export interface SFCParseResult {
  descriptor: SFCDescriptor;
}

export const DEFAULT_FILENAME = "anonymous.vue";

export function parse(
  source: string,
  { filename = DEFAULT_FILENAME, compiler = CompilerDOM }: SFCParseOptions = {},
): SFCParseResult {
  const descriptor: SFCDescriptor = {
    id: undefined!,
    filename,
    source,
    template: null,
    script: null,
    scriptSetup: null,
    styles: [],
  };

  const ast = compiler.parse(source);
  ast.children.forEach((node) => {
    if (node.type !== NodeTypes.ELEMENT) return;

    switch (node.tag) {
      case "template": {
        descriptor.template = createBlock(node, source) as SFCTemplateBlock;
        break;
      }
      case "script": {
        const scriptBlock = createBlock(node, source) as SFCScriptBlock;
        // Check for setup attribute
        const hasSetup = node.props.some(
          (p) => p.type === NodeTypes.ATTRIBUTE && p.name === "setup"
        );
        scriptBlock.setup = hasSetup;
        if (hasSetup) {
          descriptor.scriptSetup = scriptBlock;
        } else {
          descriptor.script = scriptBlock;
        }
        break;
      }
      case "style": {
        descriptor.styles.push(createBlock(node, source) as SFCStyleBlock);
        break;
      }
      default: {
        break;
      }
    }
  });

  return { descriptor };
}

function createBlock(node: ElementNode, source: string): SFCBlock {
  const type = node.tag;

  let { start, end } = node.loc;
  start = node.children[0].loc.start;
  end = node.children[node.children.length - 1].loc.end;
  const content = source.slice(start.offset, end.offset);

  const loc = { source: content, start, end };
  const block: SFCBlock = { type, content, loc };

  return block;
}
