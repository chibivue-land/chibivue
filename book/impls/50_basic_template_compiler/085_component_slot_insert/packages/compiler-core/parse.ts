import {
  type AttributeNode,
  type CommentNode,
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  type ExpressionNode,
  type InterpolationNode,
  NodeTypes,
  type Position,
  type RootNode,
  type SourceLocation,
  type TemplateChildNode,
  type TextNode,
  createRoot,
} from "./ast";
import type { ParserOptions } from "./options";
import { advancePositionWithClone } from "./utils";

type OptionalOptions = "isNativeTag"; // | TODO:

type MergedParserOptions = Omit<Required<ParserOptions>, OptionalOptions> &
  Pick<ParserOptions, OptionalOptions>;

export const defaultParserOptions: MergedParserOptions = {};

export interface ParserContext {
  readonly originalSource: string;
  options: MergedParserOptions;
  source: string;

  offset: number;
  line: number;
  column: number;
}

function createParserContext(content: string, rawOptions: ParserOptions): ParserContext {
  const options = Object.assign({}, defaultParserOptions);

  let key: keyof ParserOptions;
  for (key in rawOptions) {
    options[key] = rawOptions[key] === undefined ? defaultParserOptions[key] : rawOptions[key];
  }

  return {
    options,
    originalSource: content,
    source: content,
    column: 1,
    line: 1,
    offset: 0,
  };
}

export const baseParse = (content: string, options: ParserOptions = {}): RootNode => {
  const context = createParserContext(content, options);
  const children = parseChildren(context, []);
  return createRoot(children);
};

function parseChildren(context: ParserContext, ancestors: ElementNode[]): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = [];

  while (!isEnd(context, ancestors)) {
    const s = context.source;
    let node: TemplateChildNode | undefined = undefined;
    if (startsWith(s, "{{")) {
      node = parseInterpolation(context);
    } else if (s[0] === "<") {
      if (s[1] === "!") {
        // https://html.spec.whatwg.org/multipage/parsing.html#markup-declaration-open-state
        if (startsWith(s, "<!--")) {
          node = parseComment(context);
        }
      } else if (/[a-z]/i.test(s[1])) {
        node = parseElement(context, ancestors);
      }
    }

    if (!node) {
      node = parseText(context);
    }

    pushNode(nodes, node);
  }

  return nodes;
}

function parseComment(context: ParserContext): CommentNode {
  const start = getCursor(context);
  let content: string;

  // Regular comment.
  const match = /--(\!)?>/.exec(context.source);
  if (!match) {
    content = context.source.slice(4);
    advanceBy(context, context.source.length);
    throw new Error("EOF_IN_COMMENT"); // TODO: error handling
  } else {
    if (match.index <= 3) {
      throw new Error("ABRUPT_CLOSING_OF_EMPTY_COMMENT"); // TODO: error handling
    }
    if (match[1]) {
      throw new Error("INCORRECTLY_CLOSED_COMMENT"); // TODO: error handling
    }
    content = context.source.slice(4, match.index);

    const s = context.source.slice(0, match.index);
    let prevIndex = 1,
      nestedIndex = 0;
    while ((nestedIndex = s.indexOf("<!--", prevIndex)) !== -1) {
      advanceBy(context, nestedIndex - prevIndex + 1);
      if (nestedIndex + 4 < s.length) {
        throw new Error("NESTED_COMMENT"); // TODO: error handling
      }
      prevIndex = nestedIndex + 1;
    }
    advanceBy(context, match.index + match[0].length - prevIndex + 1);
  }

  return {
    type: NodeTypes.COMMENT,
    content,
    loc: getSelection(context, start),
  };
}

function advanceBy(context: ParserContext, numberOfCharacters: number): void {
  const { source } = context;
  advancePositionWithMutation(context, source, numberOfCharacters);
  context.source = source.slice(numberOfCharacters);
}

function advancePositionWithMutation(
  pos: Position,
  source: string,
  numberOfCharacters: number = source.length,
): Position {
  let linesCount = 0;
  let lastNewLinePos = -1;
  for (let i = 0; i < numberOfCharacters; i++) {
    if (source.charCodeAt(i) === 10 /* newline char code */) {
      linesCount++;
      lastNewLinePos = i;
    }
  }

  pos.offset += numberOfCharacters;
  pos.line += linesCount;
  pos.column =
    lastNewLinePos === -1 ? pos.column + numberOfCharacters : numberOfCharacters - lastNewLinePos;

  return pos;
}

function isEnd(context: ParserContext, ancestors: ElementNode[]): boolean {
  const s = context.source;

  if (startsWith(s, "</")) {
    for (let i = ancestors.length - 1; i >= 0; --i) {
      if (startsWithEndTagOpen(s, ancestors[i].tag)) {
        return true;
      }
    }
  }

  return !s;
}

function startsWith(source: string, searchString: string): boolean {
  return source.startsWith(searchString);
}

function advanceSpaces(context: ParserContext): void {
  const match = /^[\t\r\n\f ]+/.exec(context.source);
  if (match) {
    advanceBy(context, match[0].length);
  }
}

function pushNode(nodes: TemplateChildNode[], node: TemplateChildNode): void {
  if (node.type === NodeTypes.TEXT) {
    const prev = last(nodes);
    if (prev && prev.type === NodeTypes.TEXT) {
      prev.content += node.content;
      return;
    }
  }

  nodes.push(node);
}
function parseInterpolation(context: ParserContext): InterpolationNode | undefined {
  const [open, close] = ["{{", "}}"];
  const closeIndex = context.source.indexOf(close, open.length);
  if (closeIndex === -1) return undefined;

  const start = getCursor(context);
  advanceBy(context, open.length);

  const innerStart = getCursor(context);
  const innerEnd = getCursor(context);
  const rawContentLength = closeIndex - open.length;
  const rawContent = context.source.slice(0, rawContentLength);
  const preTrimContent = parseTextData(context, rawContentLength);

  const content = preTrimContent.trim();

  const startOffset = preTrimContent.indexOf(content);

  if (startOffset > 0) {
    advancePositionWithMutation(innerStart, rawContent, startOffset);
  }
  const endOffset = rawContentLength - (preTrimContent.length - content.length - startOffset);
  advancePositionWithMutation(innerEnd, rawContent, endOffset);
  advanceBy(context, close.length);

  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      isStatic: false,
      content,
      loc: getSelection(context, innerStart, innerEnd),
    },
    loc: getSelection(context, start),
  };
}

function parseText(context: ParserContext): TextNode {
  const endTokens = ["<", "{{"];

  let endIndex = context.source.length;

  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1);
    if (index !== -1 && endIndex > index) {
      endIndex = index;
    }
  }

  const start = getCursor(context);
  const content = parseTextData(context, endIndex);

  return {
    type: NodeTypes.TEXT,
    content,
    loc: getSelection(context, start),
  };
}

const enum TagType {
  Start,
  End,
}

function parseElement(context: ParserContext, ancestors: ElementNode[]): ElementNode | undefined {
  // Start tag.
  const element = parseTag(context, TagType.Start); // TODO:

  if (element.isSelfClosing) {
    return element;
  }

  // Children.
  ancestors.push(element);
  const children = parseChildren(context, ancestors);
  ancestors.pop();

  element.children = children;

  // End tag.
  if (startsWithEndTagOpen(context.source, element.tag)) {
    parseTag(context, TagType.End); // TODO:
  }

  return element;
}

function parseTag(context: ParserContext, type: TagType): ElementNode {
  // Tag open.
  const start = getCursor(context);
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)!;
  const tag = match[1];

  advanceBy(context, match[0].length);
  advanceSpaces(context);

  // Attributes.
  let props = parseAttributes(context, type);

  // Tag close.
  let isSelfClosing = false;

  isSelfClosing = startsWith(context.source, "/>");
  advanceBy(context, isSelfClosing ? 2 : 1);

  let tagType = ElementTypes.ELEMENT;
  if (tag === "slot") {
    tagType = ElementTypes.SLOT;
  } else if (isComponent(tag, context)) {
    tagType = ElementTypes.COMPONENT;
  }

  return {
    type: NodeTypes.ELEMENT,
    tag,
    tagType,
    props,
    children: [],
    isSelfClosing,
    codegenNode: undefined, // to be created during transform phase
    loc: getSelection(context, start),
  };
}

function isComponent(tag: string, context: ParserContext) {
  const options = context.options;
  if (/^[A-Z]/.test(tag) || (options.isNativeTag && !options.isNativeTag(tag))) {
    return true;
  }
}

function parseAttributes(context: ParserContext, type: TagType): (AttributeNode | DirectiveNode)[] {
  const props = [];
  const attributeNames = new Set<string>();
  while (
    context.source.length > 0 &&
    !startsWith(context.source, ">") &&
    !startsWith(context.source, "/>")
  ) {
    const attr = parseAttribute(context, attributeNames);

    if (type === TagType.Start) {
      props.push(attr);
    }

    advanceSpaces(context);
  }
  return props;
}

type AttributeValue =
  | {
      content: string;
      loc: SourceLocation;
    }
  | undefined;

function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode | DirectiveNode {
  // Name.
  const start = getCursor(context);
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!;
  const name = match[0];

  nameSet.add(name);

  advanceBy(context, name.length);

  // Value
  let value: AttributeValue = undefined;

  if (/^[\t\r\n\f ]*=/.test(context.source)) {
    advanceSpaces(context);
    advanceBy(context, 1);
    advanceSpaces(context);
    value = parseAttributeValue(context);
  }

  // directive
  const loc = getSelection(context, start);
  if (/^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)) {
    const match = /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(name)!;

    let dirName =
      match[1] ||
      (startsWith(name, ":")
        ? "bind"
        : startsWith(name, "@")
          ? "on"
          : startsWith(name, "#")
            ? "slot"
            : "");

    let arg: ExpressionNode | undefined;

    if (match[2]) {
      const startOffset = name.lastIndexOf(match[2]);
      const loc = getSelection(
        context,
        getNewPosition(context, start, startOffset),
        getNewPosition(context, start, startOffset + match[2].length),
      );

      let content = match[2];
      let isStatic = true;

      if (content.startsWith("[")) {
        isStatic = false;
        if (!content.endsWith("]")) {
          console.error(`Invalid dynamic argument expression: ${content}`);
          content = content.slice(1);
        } else {
          content = content.slice(1, content.length - 1);
        }
      }

      arg = {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content,
        isStatic,
        loc,
      };
    }

    const modifiers = match[3] ? match[3].slice(1).split(".") : [];

    return {
      type: NodeTypes.DIRECTIVE,
      name: dirName,
      exp: value && {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: value.content,
        isStatic: false,
        loc: value.loc,
      },
      loc,
      arg,
      modifiers,
    };
  }

  return {
    type: NodeTypes.ATTRIBUTE,
    name,
    value: value && {
      type: NodeTypes.TEXT,
      content: value.content,
      loc: value.loc,
    },
    loc,
  };
}

function parseAttributeValue(context: ParserContext): AttributeValue {
  const start = getCursor(context);
  let content: string;

  const quote = context.source[0];
  const isQuoted = quote === `"` || quote === `'`;
  if (isQuoted) {
    // Quoted value.
    advanceBy(context, 1);

    const endIndex = context.source.indexOf(quote);
    if (endIndex === -1) {
      content = parseTextData(context, context.source.length);
    } else {
      content = parseTextData(context, endIndex);
      advanceBy(context, 1);
    }
  } else {
    // Unquoted
    const match = /^[^\t\r\n\f >]+/.exec(context.source);
    if (!match) {
      return undefined;
    }
    content = parseTextData(context, match[0].length);
  }

  return { content, loc: getSelection(context, start) };
}

function parseTextData(context: ParserContext, length: number): string {
  const rawText = context.source.slice(0, length);
  advanceBy(context, length);
  return rawText;
}

function getCursor(context: ParserContext): Position {
  const { column, line, offset } = context;
  return { column, line, offset };
}

function getSelection(context: ParserContext, start: Position, end?: Position): SourceLocation {
  end = end || getCursor(context);
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset),
  };
}

function getNewPosition(
  context: ParserContext,
  start: Position,
  numberOfCharacters: number,
): Position {
  return advancePositionWithClone(
    start,
    context.originalSource.slice(start.offset, numberOfCharacters),
    numberOfCharacters,
  );
}

function last<T>(xs: T[]): T | undefined {
  return xs[xs.length - 1];
}

function startsWithEndTagOpen(source: string, tag: string): boolean {
  return (
    startsWith(source, "</") &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
    /[\t\r\n\f />]/.test(source[2 + tag.length] || ">")
  );
}
