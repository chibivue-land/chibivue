import type { VNode } from "@chibivue/runtime-core";
import { isFunction } from "@chibivue/shared";

import type { VaporComponent, VaporComponentInternalInstance } from "@chibivue/runtime-vapor";
import { createVaporComponentInstance } from "@chibivue/runtime-vapor";

import { escapeHtml } from "./helpers/ssrUtils";
import { type SSRBuffer, createBuffer } from "./render";

export function renderVaporComponentToString(
  vnode: VNode,
  parentInstance: VaporComponentInternalInstance | null = null,
): SSRBuffer | Promise<SSRBuffer> {
  const instance = createVaporComponentInstance(vnode, parentInstance);
  return renderVaporComponentSubTree(instance);
}

function renderVaporComponentSubTree(instance: VaporComponentInternalInstance): SSRBuffer {
  const { getBuffer, push } = createBuffer();
  const comp = instance.type as VaporComponent;

  if (isFunction(comp)) {
    // In SSR context, we need to mock the DOM APIs
    // For vapor, we generate the template HTML directly
    try {
      // Create a mock vapor context for SSR
      const ssrContext = createSSRVaporContext(push);

      // Execute the vapor component with SSR context
      // The component function expects to return a VaporNode (Element)
      // In SSR, we intercept the template() call and generate HTML
      const originalTemplate = globalThis.document;

      // Set up SSR vapor globals
      setupSSRVaporGlobals(ssrContext);

      // Call the component - it will use our mocked globals
      comp(instance);

      // Get the rendered HTML
      push(ssrContext.getHTML());

      // Restore globals
      restoreVaporGlobals();
    } catch (e) {
      // Fallback: render a placeholder
      console.warn(`Vapor SSR render failed:`, e);
      push(`<!---->`);
    }
  } else {
    push(`<!---->`);
  }

  return getBuffer();
}

interface SSRVaporContext {
  html: string;
  push: (item: string) => void;
  getHTML: () => string;
}

function createSSRVaporContext(push: (item: string) => void): SSRVaporContext {
  let html = "";
  return {
    html,
    push,
    getHTML: () => html,
  };
}

// Mock DOM element for SSR
class SSRElement {
  tagName: string;
  attributes: Map<string, string> = new Map();
  children: (SSRElement | SSRText)[] = [];
  textContent: string = "";
  parentElement: SSRElement | null = null;
  __is_vapor: boolean = true;

  constructor(tagName: string) {
    this.tagName = tagName.toLowerCase();
  }

  get firstChild(): SSRElement | SSRText | null {
    return this.children[0] || null;
  }

  get firstElementChild(): SSRElement | null {
    return (this.children.find((c) => c instanceof SSRElement) as SSRElement) || null;
  }

  get childNodes(): (SSRElement | SSRText)[] {
    return this.children;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) || null;
  }

  addEventListener(): void {
    // No-op in SSR
  }

  appendChild(child: SSRElement | SSRText): void {
    child.parentElement = this;
    this.children.push(child);
  }

  toHTML(): string {
    const voidTags = [
      "br",
      "hr",
      "img",
      "input",
      "meta",
      "link",
      "area",
      "base",
      "col",
      "embed",
      "source",
      "track",
      "wbr",
    ];

    let html = `<${this.tagName}`;

    for (const [name, value] of this.attributes) {
      if (value === "") {
        html += ` ${name}`;
      } else {
        html += ` ${name}="${escapeHtml(value)}"`;
      }
    }

    html += ">";

    if (!voidTags.includes(this.tagName)) {
      if (this.textContent && this.children.length === 0) {
        html += escapeHtml(this.textContent);
      } else {
        for (const child of this.children) {
          html += child.toHTML();
        }
      }
      html += `</${this.tagName}>`;
    }

    return html;
  }
}

class SSRText {
  textContent: string;
  parentElement: SSRElement | null = null;

  constructor(text: string) {
    this.textContent = text;
  }

  toHTML(): string {
    return escapeHtml(this.textContent);
  }
}

// SSR mock document
class SSRDocument {
  createElement(tagName: string): SSRElement {
    return new SSRElement(tagName);
  }

  createTextNode(text: string): SSRText {
    return new SSRText(text);
  }

  createComment(text: string): SSRText {
    return new SSRText(`<!--${text}-->`);
  }
}

let originalDocument: any;
let ssrDocument: SSRDocument;

function setupSSRVaporGlobals(context: SSRVaporContext): void {
  if (typeof globalThis.document !== "undefined") {
    originalDocument = globalThis.document;
  }
  ssrDocument = new SSRDocument();
  (globalThis as any).document = ssrDocument;
}

function restoreVaporGlobals(): void {
  if (originalDocument) {
    (globalThis as any).document = originalDocument;
  }
}

// Simple vapor SSR template helper
export function ssrVaporTemplate(html: string): string {
  return html;
}

// Simple vapor SSR setText helper
export function ssrVaporSetText(format: string, ...values: any[]): string {
  let text = format;
  for (let i = 0; i < values.length; i++) {
    text = text.replace("{}", String(values[i]));
  }
  return escapeHtml(text);
}
