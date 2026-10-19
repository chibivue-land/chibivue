import { readdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { JSDOM } from "jsdom";
import type { Plugin } from "vite";

/**
 * Reports whether a dev URL or a built file is an `index.html` page.
 * A directory URL such as `/zh-cn/00-introduction/010-about/` is that route's
 * index page. `404.html`, JSON, and Vite internal URLs are not.
 */
function isIndexHtmlRequest(target: string | undefined): boolean {
  if (!target || target.startsWith("/@")) return false;
  const pathname = target.split("?")[0]?.split("#")[0] ?? "";
  const base = pathname.split(/[/\\]/).pop() ?? "";
  return base === "" || base === "index.html" || !base.includes(".");
}

/**
 * Points the header logo at the current locale's home page.
 *
 * Ox Content renders the logo as `/index.html` on every page. English hides
 * its locale prefix, so that href is already correct there and the original
 * HTML is returned unchanged. Other locales use the same destination as the
 * localized Home item, such as `/ja/index.html`. The updated document is
 * serialized by jsdom, which also rewrites unrelated markup.
 */
export function localizeHeaderLogo(html: string): string {
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const lang = document.documentElement.lang.toLowerCase();
  if (!lang || lang === "en" || !/^[a-z]{2}(?:-[a-z]{2})?$/.test(lang)) return html;

  const logo = document.querySelector("a.header-title");
  const href = `/${lang}/index.html`;
  if (!logo || logo.getAttribute("href") === href) return html;

  logo.setAttribute("href", href);
  return dom.serialize();
}

/**
 * Rewrites the logo on an index.html response before the body is sent.
 * Ox Content sends the whole page with one `res.end(html)` call.
 * Other responses are passed through unchanged.
 */
function rewriteHtmlResponse(req: IncomingMessage, res: ServerResponse): void {
  const end = res.end;
  /**
   * Rewrites an index.html body, then sends the original chunk for every other response.
   */
  res.end = function (chunk, ...rest) {
    if (!isIndexHtmlRequest(req.url) || typeof chunk !== "string") return end.call(this, chunk, ...rest);

    const localized = localizeHeaderLogo(chunk);

    if (localized === chunk) return end.call(this, chunk, ...rest);

    res.setHeader("content-length", Buffer.byteLength(localized));
    return end.call(this, localized);
  } as ServerResponse["end"];
}

/**
 * Rewrites the logo href in every generated HTML file under `dir`.
 * Skips a missing output directory, which is the case while the dev server is running.
 */
async function rewriteBuiltHtml(dir: string): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await rewriteBuiltHtml(filePath);
        return;
      }
      if (!entry.isFile() || !isIndexHtmlRequest(filePath)) return;
      const html = await readFile(filePath, "utf8");
      const localized = localizeHeaderLogo(html);
      if (localized !== html) await writeFile(filePath, localized);
    }),
  );
}

/**
 * Applies {@link localizeHeaderLogo} to dev HTML and to the built site.
 * The dev middleware is registered first so it can wrap the response Ox Content writes.
 * The build pass runs after Ox Content has written `dist`.
 */
export function localizeHeaderLogoPlugins(): Plugin[] {
  let outDir = "";
  return [
    {
      name: "chibivue:localize-header-logo",
      enforce: "pre",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          rewriteHtmlResponse(req, res);
          next();
        });
      },
    },
    {
      name: "chibivue:localize-header-logo-build",
      enforce: "post",
      configResolved(config) {
        outDir = path.resolve(config.root, config.build.outDir);
      },
      async closeBundle() {
        if (!outDir) return;
        await rewriteBuiltHtml(outDir);
      },
    },
  ];
}
