import { readFileSync } from "node:fs";
import { defineConfig } from "vite-plus";
import { oxContent, defineTheme, defaultTheme } from "@ox-content/vite-plugin";
import { nav } from "./config/nav";
import { sidebar } from "./config/sidebar";
import { home } from "./theme/home";
import { kawaikoNote } from "./theme/kawaiko-note";

const SITE_URL = "https://book.chibivue.land";
const DESCRIPTION = 'Writing Vue.js: Step by Step, from just one line of "Hello, World".';
const ART_BASE = "https://raw.githubusercontent.com/chibivue-land/art/main";

const fromHere = (path: string) => new URL(path, import.meta.url);

// The OG template runs in a headless browser; inline the logo so rendering
// never reaches for the network.
process.env.CHIBIVUE_OG_LOGO = `data:image/png;base64,${readFileSync(
  fromHere("src/public/figures/_brand/logo.png"),
).toString("base64")}`;

export default defineConfig({
  root: fromHere(".").pathname,
  publicDir: "src/public",
  build: {
    outDir: "dist",
  },
  plugins: [
    oxContent({
      srcDir: "src",
      outDir: "dist",
      docs: false,

      highlight: true,
      containers: true,
      codeAnnotations: { notation: "vitepress" },
      transformers: [home, kawaikoNote],
      icons: { include: ["mdi:github", "mdi:twitter", "mdi:discord", "mdi:heart"] },

      ogImage: true,
      ogImageOptions: {
        template: "./theme/og-image.ts",
        concurrency: 4,
      },

      editThisPage: {
        repoUrl: "https://github.com/chibivue-land/chibivue",
        branch: "main",
        rootDir: "book/online-book/src",
        label: "Suggest changes to this page",
      },

      i18n: {
        enabled: true,
        defaultLocale: "en",
        locales: [
          { code: "en", name: "English" },
          { code: "ja", name: "日本語" },
          { code: "zh-cn", name: "简体中文" },
          { code: "zh-tw", name: "繁體中文" },
        ],
        hideDefaultLocale: true,
        check: false,
      },

      ssg: {
        siteName: "The chibivue Book",
        siteUrl: SITE_URL,
        ogImage: `${SITE_URL}/og.png`,
        generateOgImage: true,
        lastUpdated: true,
        pagination: true,
        localeSwitcher: true,
        readerChrome: true,
        a11y: true,
        notFound: true,
        pageChrome: true,
        theme: defineTheme({
          extends: defaultTheme,
          aside: true,
          colors: {
            primary: "#159d82",
            primaryHover: "#0f8770",
            text: "#1a2744",
            textMuted: "#2e3f60",
          },
          darkColors: {
            primary: "#2cc9a8",
            primaryHover: "#50d6bd",
            background: "#0f1724",
            backgroundAlt: "#151e2d",
            text: "#e2ebf0",
            textMuted: "#b8c9d4",
            border: "#2a3a50",
          },
          header: {
            logo: "/figures/_brand/logo.png",
          },
          nav,
          sidebar,
          socialLinks: [
            {
              icon: {
                svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><image href="${ART_BASE}/kawaiko.png" width="20" height="20"/></svg>`,
              },
              link: "https://chibivue.land",
              ariaLabel: "chibivue.land",
            },
            {
              icon: "mdi:github",
              link: "https://github.com/chibivue-land/chibivue",
              ariaLabel: "GitHub",
            },
            { icon: "mdi:twitter", link: "https://twitter.com/ubugeeei", ariaLabel: "Twitter" },
            { icon: "mdi:discord", link: "https://discord.gg/aVHvmbmSRy", ariaLabel: "Discord" },
            {
              icon: "mdi:heart",
              link: "https://github.com/sponsors/ubugeeei",
              ariaLabel: "Sponsor",
            },
          ],
          footer: {
            message: "Released under the MIT License.",
            copyright: `Copyright © 2023-${new Date().getFullYear()} ubugeeei`,
          },
          embed: {
            head: `<link rel="icon" href="/figures/_brand/logo.png">
<meta name="description" content="${DESCRIPTION.replace(/"/g, "&quot;")}">
<meta name="twitter:site" content="@ubugeeei">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f1724" media="(prefers-color-scheme: dark)">`,
            sidebarAfter: `<script>${readFileSync(fromHere("theme/restore-sidebar.js"), "utf8")}</script>`,
          },
          css: ["theme/style.css", "theme/home.css"]
            .map((file) => readFileSync(fromHere(file), "utf8"))
            .join("\n"),
          // Remember the reader's language for the Netlify locale redirect.
          js: `document.cookie = "nf_lang=" + document.documentElement.lang.toLowerCase() + "; expires=Mon, 1 Jan 2030 00:00:00 UTC; path=/";`,
        }),
      },
    }),
  ],
});
