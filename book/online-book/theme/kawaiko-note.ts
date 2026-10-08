import type { MarkdownTransformer } from "@ox-content/vite-plugin";

type Variant = "base" | "angry" | "funny" | "question" | "surprise" | "warning";
type NoteType = "info" | "tip" | "warning" | "danger" | "success";

const ART_BASE = "https://raw.githubusercontent.com/chibivue-land/art/main";

const MASCOT_IMAGES: Record<Variant, string> = {
  base: `${ART_BASE}/kawaiko.png`,
  angry: `${ART_BASE}/kawaiko_angry.png`,
  funny: `${ART_BASE}/kawaiko_funny.png`,
  question: `${ART_BASE}/kawaiko_question.png`,
  surprise: `${ART_BASE}/kawaiko_surprise.png`,
  warning: `${ART_BASE}/kawaiko_warning.png`,
};

const TYPE_TO_VARIANT: Record<NoteType, Variant> = {
  warning: "warning",
  danger: "angry",
  tip: "funny",
  success: "base",
  info: "question",
};

const OPEN_TAG = /<KawaikoNote\b([^>]*)>/g;
const CLOSE_TAG = /<\/KawaikoNote\s*>/g;
const ATTRIBUTE = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function renderOpenTag(rawAttributes: string): string {
  const attributes: Record<string, string> = {};
  for (const [, name, double, single] of rawAttributes.matchAll(ATTRIBUTE)) {
    attributes[name] = double ?? single ?? "";
  }

  const variant = pick(
    attributes.variant,
    ["base", "angry", "funny", "question", "surprise", "warning"],
    "base",
  );
  const type = pick(attributes.type, ["info", "tip", "warning", "danger", "success"], "info");
  const position = pick(attributes.position, ["left", "right"], "left");
  const size = pick(attributes.size, ["sm", "md", "lg"], "md");
  const effectiveVariant = variant === "base" ? TYPE_TO_VARIANT[type] : variant;
  const title = attributes.title
    ? `<div class="kawaiko-note__title">${escapeHtml(attributes.title)}</div>`
    : "";

  return (
    `<div class="kawaiko-note kawaiko-note--${size} kawaiko-note--${type} kawaiko-note--${position}">` +
    `<div class="kawaiko-note__mascot"><img src="${MASCOT_IMAGES[effectiveVariant]}" ` +
    `alt="Kawaiko mascot - ${effectiveVariant}" class="kawaiko-note__image" loading="lazy"></div>` +
    `<div class="kawaiko-note__content">${title}<div class="kawaiko-note__body">`
  );
}

interface HtmlLikeNode {
  type: string;
  value?: string;
  children?: HtmlLikeNode[];
}

function visit(node: HtmlLikeNode): void {
  if (node.type === "html" && typeof node.value === "string") {
    node.value = node.value
      .replace(OPEN_TAG, (_, attributes: string) => renderOpenTag(attributes))
      .replace(CLOSE_TAG, "</div></div></div>");
  }
  node.children?.forEach(visit);
}

/**
 * Renders `<KawaikoNote>` blocks as static HTML at build time, so the
 * mascot callouts need no client-side JavaScript. Markdown between the
 * opening and closing tags keeps rendering as Markdown.
 */
export const kawaikoNote: MarkdownTransformer = {
  name: "chibivue:kawaiko-note",
  transform(ast) {
    visit(ast as HtmlLikeNode);
    return ast;
  },
};
