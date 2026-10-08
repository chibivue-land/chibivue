/**
 * Per-page Open Graph image template.
 *
 * Ox Content bundles this file and renders the returned HTML to a 1200x630 PNG
 * for every page. Props come from the page's first heading and frontmatter.
 * The logo is inlined by `vite.config.ts` through `CHIBIVUE_OG_LOGO` so the
 * render never depends on the network.
 */

interface OgImageProps {
  title: string;
  description?: string;
  siteName?: string;
  [key: string]: unknown;
}

const TAGLINE = 'Writing Vue.js: Step by Step, from just one line of "Hello, World".';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function ogImage(props: OgImageProps): string {
  const title = escapeHtml(props.title.replace(/\s*🚧\s*/g, " ").trim());
  const description = escapeHtml(props.description ?? TAGLINE);
  const siteName = escapeHtml(props.siteName ?? "The chibivue Book");
  const logo = process.env.CHIBIVUE_OG_LOGO;
  const titleSize = title.length > 48 ? 52 : title.length > 28 ? 62 : 72;

  return `<div style="
    width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;
    padding:64px 80px;
    background:
      linear-gradient(rgba(26,39,68,0.06) 1px, transparent 1px) 0 0 / 40px 40px,
      linear-gradient(90deg, rgba(26,39,68,0.06) 1px, transparent 1px) 0 0 / 40px 40px,
      linear-gradient(120deg, #1d4f9a 0%, #2a7fb8 28%, #8be4d3 70%, #e8faf6 100%);
    font-family:'Inter','Noto Sans JP','Noto Sans CJK JP','Hiragino Sans','PingFang SC','Microsoft YaHei',system-ui,sans-serif;
    color:#1a2744;">
  <div style="display:flex;align-items:center;gap:16px;">
    ${logo ? `<img src="${logo}" alt="" style="height:56px;">` : ""}
    <span style="font-size:32px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">chibivue</span>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px;">
    <h1 style="
      margin:0;max-width:960px;
      font-size:${titleSize}px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;
      color:#ffffff;text-shadow:0 2px 16px rgba(26,39,68,0.35);
      overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${title}</h1>
    <p style="
      margin:0;max-width:900px;font-size:26px;line-height:1.5;font-weight:500;color:#e8faf6;
      overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${description}</p>
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;font-size:22px;font-weight:600;color:#1a2744;">
    <span>${siteName}</span>
    <span>book.chibivue.land</span>
  </div>
</div>`;
}
