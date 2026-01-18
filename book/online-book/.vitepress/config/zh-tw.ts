import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";

export const zhTwConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  themeConfig: {
    nav: [
      { text: "首頁", link: "/zh-tw/" },
      { text: "開始學習", link: "/zh-tw/00-introduction/010-about" },
    ],
    sidebar: [
      {
        text: "入門指南",
        collapsed: false,
        items: [
          { text: "入門指南", link: "/zh-tw/00-introduction/010-about" },
          {
            text: "什麼是 Vue.js？",
            link: "/zh-tw/00-introduction/020-what-is-vue",
          },
          {
            text: "Vue.js 的關鍵要素",
            link: "/zh-tw/00-introduction/030-vue-core-components",
          },
          {
            text: "本書的方法和環境設置",
            link: "/zh-tw/00-introduction/040-setup-project",
          },
        ],
      },
      {
        text: "最小示例",
        collapsed: false,
        items: [
          {
            text: "第一次渲染和 createApp API",
            link: "/zh-tw/10-minimum-example/010-create-app-api",
          },
          {
            text: "套件架構",
            link: "/zh-tw/10-minimum-example/015-package-architecture",
          },
          {
            text: "讓我們啟用 HTML 元素渲染",
            link: "/zh-tw/10-minimum-example/020-simple-h-function",
          },
          {
            text: "讓我們支援事件處理器和屬性",
            link: "/zh-tw/10-minimum-example/025-event-handler-and-attrs",
          },
          {
            text: "響應式系統的前置知識",
            link: "/zh-tw/10-minimum-example/030-prerequisite-knowledge-for-the-reactivity-system",
          },
          {
            text: "嘗試實現一個小型響應式系統",
            link: "/zh-tw/10-minimum-example/035-try-implementing-a-minimum-reactivity-system",
          },
          {
            text: "最小虛擬 DOM",
            link: "/zh-tw/10-minimum-example/040-minimum-virtual-dom",
          },
          {
            text: "追求組件導向開發",
            link: "/zh-tw/10-minimum-example/050-minimum-component",
          },
          {
            text: "組件 Props",
            link: "/zh-tw/10-minimum-example/051-component-props",
          },
          {
            text: "組件 Emit",
            link: "/zh-tw/10-minimum-example/052-component-emits",
          },
          {
            text: "理解模板編譯器",
            link: "/zh-tw/10-minimum-example/060-template-compiler",
          },
          {
            text: "實現模板編譯器",
            link: "/zh-tw/10-minimum-example/061-template-compiler-impl",
          },
          {
            text: "希望編寫更複雜的 HTML",
            link: "/zh-tw/10-minimum-example/070-more-complex-parser",
          },
          {
            text: "資料綁定",
            link: "/zh-tw/10-minimum-example/080-template-binding",
          },
          {
            text: "使用 SFC 開發（外圍知識）",
            link: "/zh-tw/10-minimum-example/090-prerequisite-knowledge-for-the-sfc",
          },
          {
            text: "解析 SFC",
            link: "/zh-tw/10-minimum-example/091-parse-sfc",
          },
          {
            text: "SFC template 區塊",
            link: "/zh-tw/10-minimum-example/092-compile-sfc-template",
          },
          {
            text: "SFC script 區塊",
            link: "/zh-tw/10-minimum-example/093-compile-sfc-script",
          },
          {
            text: "SFC style 區塊",
            link: "/zh-tw/10-minimum-example/094-compile-sfc-style",
          },
          {
            text: "稍作休息",
            link: "/zh-tw/10-minimum-example/100-break",
          },
        ],
      },
      {
        text: "基礎虛擬 DOM",
        collapsed: false,
        items: [
          {
            text: "key 屬性和補丁渲染",
            link: "/zh-tw/20-basic-virtual-dom/010-patch-keyed-children",
          },
          {
            text: "VNode 的位元級表示",
            link: "/zh-tw/20-basic-virtual-dom/020-bit-flags",
          },
          {
            text: "調度器",
            link: "/zh-tw/20-basic-virtual-dom/030-scheduler",
          },
          {
            text: "未處理 Props 的補丁",
            link: "/zh-tw/20-basic-virtual-dom/040-patch-other-attrs",
          },
        ],
      },
      {
        text: "基礎響應式系統",
        collapsed: false,
        items: [
          {
            text: "響應式最佳化",
            link: "/zh-tw/30-basic-reactivity-system/005-reactivity-optimization",
          },
          {
            text: "ref API",
            link: "/zh-tw/30-basic-reactivity-system/010-ref-api",
          },
          {
            text: "computed / watch API",
            link: "/zh-tw/30-basic-reactivity-system/020-computed-watch",
          },
          {
            text: "各種響應式代理處理器",
            link: "/zh-tw/30-basic-reactivity-system/030-reactive-proxy-handlers",
          },
          {
            text: "Effect 清理和 Effect 作用域",
            link: "/zh-tw/30-basic-reactivity-system/040-effect-scope",
          },
          {
            text: "其他響應式 API",
            link: "/zh-tw/30-basic-reactivity-system/050-other-apis",
          },
        ],
      },
      {
        text: "基礎組件系統",
        collapsed: false,
        items: [
          {
            text: "生命週期鉤子",
            link: "/zh-tw/40-basic-component-system/010-lifecycle-hooks",
          },
          {
            text: "Provide/Inject",
            link: "/zh-tw/40-basic-component-system/020-provide-inject",
          },
          {
            text: "組件代理和 setupContext",
            link: "/zh-tw/40-basic-component-system/030-component-proxy-setup-context",
          },
          {
            text: "插槽",
            link: "/zh-tw/40-basic-component-system/040-component-slot",
          },
          {
            text: "支援 Options API",
            link: "/zh-tw/40-basic-component-system/050-options-api",
          },
        ],
      },
      {
        text: "基礎模板編譯器",
        collapsed: false,
        items: [
          {
            text: "重構 Transformer 的 Codegen 實現",
            link: "/zh-tw/50-basic-template-compiler/010-transform",
          },
          {
            text: "實現指令（v-bind）",
            link: "/zh-tw/50-basic-template-compiler/020-v-bind",
          },
          {
            text: "在模板中求值表達式",
            link: "/zh-tw/50-basic-template-compiler/022-transform-expression",
          },
          {
            text: "支援 v-on",
            link: "/zh-tw/50-basic-template-compiler/025-v-on",
          },
          {
            text: "compiler-dom 和事件修飾符",
            link: "/zh-tw/50-basic-template-compiler/027-event-modifier",
          },
          {
            text: "支援 Fragment",
            link: "/zh-tw/50-basic-template-compiler/030-fragment",
          },
          {
            text: "支援註釋節點",
            link: "/zh-tw/50-basic-template-compiler/035-comment",
          },
          {
            text: "v-if 和結構指令",
            link: "/zh-tw/50-basic-template-compiler/040-v-if-and-structural-directive",
          },
          {
            text: "支援 v-for",
            link: "/zh-tw/50-basic-template-compiler/050-v-for",
          },
          {
            text: "解析組件",
            link: "/zh-tw/50-basic-template-compiler/070-resolve-component",
          },
          {
            text: "支援插槽（定義）",
            link: "/zh-tw/50-basic-template-compiler/080-component-slot-outlet",
          },
          {
            text: "支援插槽（使用）",
            link: "/zh-tw/50-basic-template-compiler/085-component-slot-insert",
          },
          {
            text: "其他指令",
            link: "/zh-tw/50-basic-template-compiler/090-other-directives",
          },
          {
            text: "編譯器細節優化",
            link: "/zh-tw/50-basic-template-compiler/100-chore-compiler",
          },
          {
            text: "解析器優化",
            link: "/zh-tw/50-basic-template-compiler/110-parser-optimization",
          },
          {
            text: "自訂指令",
            link: "/zh-tw/50-basic-template-compiler/500-custom-directive",
          },
        ],
      },
      {
        text: "基礎 SFC 編譯器",
        collapsed: false,
        items: [
          {
            text: "支援 script setup",
            link: "/zh-tw/60-basic-sfc-compiler/010-script-setup",
          },
          {
            text: "支援 defineProps",
            link: "/zh-tw/60-basic-sfc-compiler/020-define-props",
          },
          {
            text: "支援 defineEmits",
            link: "/zh-tw/60-basic-sfc-compiler/030-define-emits",
          },
          {
            text: "支援作用域 CSS",
            link: "/zh-tw/60-basic-sfc-compiler/040-scoped-css",
          },
          {
            text: "支援 Props 解構",
            link: "/zh-tw/60-basic-sfc-compiler/050-props-destructure",
          },
          {
            text: "基於類型的 defineProps/defineEmits",
            link: "/zh-tw/60-basic-sfc-compiler/060-type-based-macros",
          },
        ],
      },
      {
        text: "Web 應用程式要點",
        collapsed: false,
        items: [
          {
            text: "外掛",
            collapsed: false,
            items: [
              {
                text: "路由器",
                link: "/zh-tw/90-web-application-essentials/010-plugins/010-router",
              },
              {
                text: "CSS 預處理器",
                link: "/zh-tw/90-web-application-essentials/010-plugins/020-preprocessors",
              },
            ],
          },
          {
            text: "伺服器端渲染",
            collapsed: false,
            items: [
              {
                text: "renderToString",
                link: "/zh-tw/90-web-application-essentials/020-ssr/010-create-ssr-app",
              },
              {
                text: "Hydration（水合）",
                link: "/zh-tw/90-web-application-essentials/020-ssr/020-hydration",
              },
              {
                text: "Compiler SSR",
                link: "/zh-tw/90-web-application-essentials/020-ssr/030-compiler-ssr",
              },
            ],
          },
          {
            text: "內建組件",
            collapsed: false,
            items: [
              {
                text: "KeepAlive",
                link: "/zh-tw/90-web-application-essentials/030-builtins/010-keep-alive",
              },
              {
                text: "Transition",
                link: "/zh-tw/90-web-application-essentials/030-builtins/030-transition",
              },
            ],
          },
          {
            text: "最佳化",
            collapsed: false,
            items: [
              {
                text: "靜態提升",
                link: "/zh-tw/90-web-application-essentials/040-optimizations/010-static-hoisting",
              },
              {
                text: "補丁標誌",
                link: "/zh-tw/90-web-application-essentials/040-optimizations/020-patch-flags",
              },
              {
                text: "樹扁平化",
                link: "/zh-tw/90-web-application-essentials/040-optimizations/030-tree-flattening",
              },
            ],
          },
          {
            text: "Vapor 模式",
            collapsed: false,
            items: [
              {
                text: "Vapor 模式",
                link: "/zh-tw/90-web-application-essentials/050-vapor/010-introduction",
              },
              {
                text: "Vapor 編譯器",
                link: "/zh-tw/90-web-application-essentials/050-vapor/020-vapor-compiler",
              },
              {
                text: "Vapor SSR",
                link: "/zh-tw/90-web-application-essentials/050-vapor/030-vapor-ssr",
              },
            ],
          },
        ],
      },
      {
        text: "附錄",
        collapsed: false,
        items: [
          {
            text: "15分鐘編寫 Vue.js",
            collapsed: false,
            items: [
              {
                text: "chibivue，不是很小嗎...？",
                link: "/zh-tw/bonus/hyper-ultimate-super-extreme-minimal-vue/",
              },
              {
                text: "實現",
                link: "/zh-tw/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl",
              },
            ],
          },
          {
            text: "除錯原始 Vue.js 原始碼",
            link: "/zh-tw/bonus/debug-vuejs-core",
          },
        ],
      },
    ],
    editLink: {
      pattern: "https://github.com/chibivue-land/chibivue/blob/main/book/online-book/src/:path",
      text: "在 GitHub 上編輯此頁面",
    },
    footer: {
      message: "基於 MIT 許可證發布。",
      copyright: "Copyright © 2023-present ubugeeei",
    },
    docFooter: {
      prev: "上一頁",
      next: "下一頁",
    },
    outline: {
      label: "頁面導航",
    },
    lastUpdated: {
      text: "最後更新於",
      formatOptions: {
        dateStyle: "short",
        timeStyle: "medium",
      },
    },
    langMenuLabel: "多語言",
    returnToTopLabel: "回到頂部",
    sidebarMenuLabel: "選單",
    darkModeSwitchLabel: "主題",
    lightModeSwitchTitle: "切換到淺色模式",
    darkModeSwitchTitle: "切換到深色模式",
  },
};
