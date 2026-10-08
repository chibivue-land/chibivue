/**
 * Per-page Open Graph image template.
 *
 * Ox Content bundles this file and renders the returned HTML to a 1200x630 PNG
 * for every page. Props come from the page's first heading and frontmatter.
 * The logo and Kawaiko are inlined by `vite.config.ts` through
 * `CHIBIVUE_OG_LOGO` / `CHIBIVUE_OG_KAWAIKO` so the render never depends on
 * the network.
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
  const kawaiko = process.env.CHIBIVUE_OG_KAWAIKO;
  // The text column stops before Kawaiko, so long titles wrap instead of overlapping.
  const titleSize = title.length > 64 ? 42 : title.length > 40 ? 50 : title.length > 24 ? 58 : 68;
  const titleLines = title.length > 64 ? 4 : 3;

  return `<div style="
    position:relative;overflow:hidden;
    width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;
    padding:56px 72px;
    background:
      linear-gradient(rgba(26,39,68,0.06) 1px, transparent 1px) 0 0 / 40px 40px,
      linear-gradient(90deg, rgba(26,39,68,0.06) 1px, transparent 1px) 0 0 / 40px 40px,
      linear-gradient(120deg, #1d4f9a 0%, #2a7fb8 32%, #8be4d3 72%, #e8faf6 100%);
    font-family:'Inter','Noto Sans JP','Noto Sans CJK JP','Hiragino Sans','PingFang SC','Microsoft YaHei',system-ui,sans-serif;
    color:#1a2744;">
  ${
    kawaiko
      ? `<div style="position:absolute;right:-70px;bottom:-110px;width:560px;height:560px;border-radius:50%;background:rgba(255,255,255,0.55);"></div>
  <img src="${kawaiko}" alt="" style="position:absolute;right:10px;bottom:-6px;width:470px;height:470px;object-fit:contain;">`
      : ""
  }
  <div style="position:relative;display:flex;align-items:center;gap:16px;">
    ${logo ? `<img src="${logo}" alt="" style="height:52px;">` : ""}
    <span style="font-size:32px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">chibivue</span>
  </div>
  <div style="position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;gap:22px;max-width:${kawaiko ? 690 : 1000}px;">
    <h1 style="
      margin:0;
      font-size:${titleSize}px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;
      color:#ffffff;text-shadow:0 2px 12px rgba(26,39,68,0.45);
      overflow:hidden;display:-webkit-box;-webkit-line-clamp:${titleLines};-webkit-box-orient:vertical;">${title}</h1>
    <p style="
      margin:0;font-size:24px;line-height:1.5;font-weight:500;color:#ffffff;
      text-shadow:0 1px 8px rgba(26,39,68,0.4);
      overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${description}</p>
  </div>
  <div style="position:relative;font-size:22px;font-weight:600;color:rgba(255,255,255,0.9);">
    ${siteName} · book.chibivue.land
  </div>
</div>`;
}
