import { sharedConfig } from "./shared.js";
import { jaConfig } from "./ja";
import { enConfig } from "./en.js";
import { zhCnConfig } from "./zh-cn.js";
import { zhTwConfig } from "./zh-tw.js";
import { defineConfig } from "vitepress";

export default defineConfig({
  ...sharedConfig,
  locales: {
    root: { label: "English", lang: "en", link: "/", ...enConfig },
    ja: { label: "日本語", lang: "ja", link: "/ja", ...jaConfig },
    "zh-cn": {
      label: "简体中文",
      lang: "zh-CN",
      link: "/zh-cn",
      ...zhCnConfig,
    },
    "zh-tw": {
      label: "繁體中文",
      lang: "zh-TW",
      link: "/zh-tw",
      ...zhTwConfig,
    },
  },
});
