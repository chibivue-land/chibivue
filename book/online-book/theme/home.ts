import type { MarkdownTransformer } from "@ox-content/vite-plugin";
import pkg from "../../../package.json" with { type: "json" };

/** Landing page content, read from the `home` frontmatter of each locale's index.md. */
interface HomeFrontmatter {
  tagline: string;
  startLink: string;
  startButton: string;
  vueButton: string;
  features: Array<{ icon: FeatureIcon; title: string; details: string }>;
}

type FeatureIcon = "reactivity" | "vdom" | "compiler" | "sfc";

const MASCOT = "https://raw.githubusercontent.com/chibivue-land/art/main/kawaiko.png";

// mdi:flash, mdi:file-tree, mdi:cog, mdi:package-variant
const ICON_PATHS: Record<FeatureIcon, string> = {
  reactivity: "M7 2v11h3v9l7-12h-4l4-8z",
  vdom: "M3 3h6v4H3zm12 7h6v4h-6zm0 7h6v4h-6zm-2-4H7v5h6v2H5V9h2v2h6z",
  compiler:
    "M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64z",
  sfc: "M2 10.96a.985.985 0 0 1-.37-1.37L3.13 7c.11-.2.28-.34.47-.42l7.83-4.4c.16-.12.36-.18.57-.18s.41.06.57.18l7.9 4.44c.19.1.35.26.44.46l1.45 2.52c.28.48.11 1.09-.36 1.36l-1 .58v4.96c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18s-.41-.06-.57-.18l-7.9-4.44A.99.99 0 0 1 3 16.5v-5.54c-.3.17-.68.18-1 0m10-6.81v6.7l5.96-3.35zM5 15.91l6 3.38v-6.71L5 9.21zm14 0v-3.22l-5 2.9c-.33.18-.7.17-1 .01v3.69zm-5.15-2.55l6.28-3.63l-.58-1.01l-6.28 3.63z",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHero(home: HomeFrontmatter): string {
  return `<section class="hero-section">
  <div class="hero-background"><div class="code-pattern"></div><div class="gradient-overlay"></div></div>
  <div class="hero-content">
    <div class="hero-text">
      <h1 class="hero-title">
        <span class="gradient-text">chibivue</span>
        <span class="version-badge">v${escapeHtml(pkg.version)}</span>
      </h1>
      <p class="hero-tagline">${escapeHtml(home.tagline)}</p>
      <div class="hero-actions">
        <a href="${escapeHtml(home.startLink)}" class="btn-primary">${escapeHtml(home.startButton)} <span class="arrow">-&gt;</span></a>
        <a href="https://vuejs.org/" class="btn-secondary" target="_blank" rel="noopener">${escapeHtml(home.vueButton)}</a>
      </div>
    </div>
    <div class="hero-visual">
      <div class="stairs-container">
        <div class="stair stair-1"></div>
        <div class="stair stair-2"></div>
        <div class="stair stair-3"></div>
        <div class="stair stair-4"></div>
        <div class="stair stair-5"></div>
        <div class="mascot-container">
          <img src="${MASCOT}" alt="Kawaiko - chibivue mascot" class="mascot" loading="eager">
        </div>
      </div>
      <div class="code-snippets">
        <div class="snippet snippet-1"><code>const app = createApp()</code></div>
        <div class="snippet snippet-2"><code>ref() reactive()</code></div>
        <div class="snippet snippet-3"><code>&lt;template&gt;</code></div>
      </div>
    </div>
  </div>
</section>`;
}

function renderFeatures(home: HomeFrontmatter): string {
  const cards = home.features
    .map(
      (feature) => `<article class="feature-card">
      <div class="feature-icon"><span class="icon-glow"></span><svg class="icon-content" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path fill="currentColor" d="${ICON_PATHS[feature.icon]}"/></svg></div>
      <h3 class="feature-title">${escapeHtml(feature.title)}</h3>
      <p class="feature-description">${escapeHtml(feature.details)}</p>
      <div class="feature-hover-effect"></div>
    </article>`,
    )
    .join("\n");

  return `<section class="features-section"><div class="features-container"><div class="features-grid">
${cards}
</div></div></section>`;
}

/**
 * Renders the chibivue landing page (hero + feature cards) as static HTML
 * for pages whose frontmatter has a `home` block.
 */
export const home: MarkdownTransformer = {
  name: "chibivue:home",
  transform(ast, { frontmatter }) {
    const data = frontmatter.home as HomeFrontmatter | undefined;
    if (!data) return ast;
    return {
      ...ast,
      children: [
        {
          type: "html",
          value: `<div class="chibivue-home">${renderHero(data)}${renderFeatures(data)}</div>`,
        },
      ],
    } as typeof ast;
  },
};
