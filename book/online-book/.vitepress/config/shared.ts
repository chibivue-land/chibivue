import { defineConfig } from "vitepress";
import chibivueThemeDark from "../theme/chibivue-theme.json";
import chibivueThemeLight from "../theme/chibivue-theme-light.json";
import pkg from "../../../../package.json";

export const sharedConfig = defineConfig({
  vite: {
    define: {
      __CHIBIVUE_VERSION__: JSON.stringify(pkg.version),
    },
  },
  title: "The chibivue Book",
  appearance: "dark",
  description: 'Writing Vue.js: Step by Step, from just one line of "Hello, World".',
  lang: "en",
  srcDir: "src",
  srcExclude: ["__wip"],
  markdown: {
    theme: {
      light: chibivueThemeLight as any,
      dark: chibivueThemeDark as any,
    },
  },
  head: [
    [
      "link",
      {
        rel: "icon",
        href: "https://github.com/chibivue-land/chibivue/blob/main/book/images/logo/logo.png?raw=true",
      },
    ],

    // og
    ["meta", { property: "og:site_name", content: "chibivue" }],
    ["meta", { property: "og:url", content: "https://book.chibivue.land" }],
    ["meta", { property: "og:title", content: "chibivue" }],
    [
      "meta",
      {
        property: "og:description",
        content: 'Writing Vue.js: Step by Step, from just one line of "Hello, World".',
      },
    ],
    [
      "meta",
      {
        property: "og:image",
        content: "https://book.chibivue.land/og.png",
      },
    ],
    ["meta", { property: "og:image:alt", content: "chibivue" }],
    ["meta", { name: "twitter:site", content: "chibivue" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: "chibivue" }],
    [
      "meta",
      {
        name: "twitter:description",
        content: 'Writing Vue.js: Step by Step, from just one line of "Hello, World".',
      },
    ],
    [
      "meta",
      {
        name: "twitter:image",
        content: "https://book.chibivue.land/og.png",
      },
    ],
    ["meta", { name: "twitter:image:alt", content: "chibivue" }],
  ],
  themeConfig: {
    logo: "https://github.com/chibivue-land/chibivue/blob/main/book/images/logo/logo.png?raw=true",
    search: { provider: "local" },
    outline: "deep",
    i18nRouting: true,
    socialLinks: [
      {
        icon: {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><image href="https://raw.githubusercontent.com/chibivue-land/art/main/kawaiko.png" width="20" height="20"/></svg>',
        },
        link: "https://chibivue.land",
        ariaLabel: "chibivue.land",
      },
      { icon: "github", link: "https://github.com/chibivue-land/chibivue" },
      { icon: "twitter", link: "https://twitter.com/ubugeeei" },
      { icon: "discord", link: "https://discord.gg/aVHvmbmSRy" },
      {
        icon: {
          svg: '<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-heart-fill icon-sponsoring mr-1 v-align-middle color-fg-sponsors"><path d="M7.655 14.916v-.001h-.002l-.006-.003-.018-.01a22.066 22.066 0 0 1-3.744-2.584C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.044 5.231-3.886 6.818a22.094 22.094 0 0 1-3.433 2.414 7.152 7.152 0 0 1-.31.17l-.018.01-.008.004a.75.75 0 0 1-.69 0Z"></path></svg>',
        },
        link: "https://github.com/sponsors/ubugeeei",
      },
    ],
    editLink: {
      pattern: "https://github.com/chibivue-land/chibivue/blob/main/book/online-book/src/:path",
      text: "Suggest changes to this page",
    },
    footer: {
      copyright: `Copyright © 2023-${new Date().getFullYear()} ubugeeei`,
      message: "Released under the MIT License.",
    },
  },
});
