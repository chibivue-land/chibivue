import { defineConfig } from 'vitepress'

export const zhTwConfig = defineConfig({
  themeConfig: {
    nav: [
      { text: '首頁', link: '/zh-tw/' },
      { text: '開始學習', link: '/zh-tw/00-introduction/010-about' },
    ],
    sidebar: [
      {
        text: '介紹',
        collapsed: false,
        items: [
          { text: '關於本書', link: '/zh-tw/00-introduction/010-about' },
          { text: '前置知識', link: '/zh-tw/00-introduction/020-prerequisite' },
          { text: 'Vue.js 核心組件', link: '/zh-tw/00-introduction/030-vue-core-components' },
          { text: '環境設置', link: '/zh-tw/00-introduction/040-setup-project' },
        ],
      },
      {
        text: '最小示例',
        collapsed: false,
        items: [
          { text: 'createApp API', link: '/zh-tw/10-minimum-example/010-create-app-api' },
          { text: '簡單的 h 函式', link: '/zh-tw/10-minimum-example/020-simple-h-function' },
          { text: '簡單組件', link: '/zh-tw/10-minimum-example/030-simple-component' },
          { text: 'setup 組合式 API', link: '/zh-tw/10-minimum-example/040-setup-composition-api' },
          { text: '最小響應式', link: '/zh-tw/10-minimum-example/050-minimum-reactive' },
          { text: '響應式代理處理器', link: '/zh-tw/10-minimum-example/060-reactive-proxy-handler' },
          { text: 'computed 和 ref', link: '/zh-tw/10-minimum-example/070-computed-ref' },
          { text: '補丁鍵控子元素', link: '/zh-tw/10-minimum-example/080-patch-keyed-children' },
          { text: '模板編譯器', link: '/zh-tw/10-minimum-example/090-template-compiler' },
          { text: '最小 SFC', link: '/zh-tw/10-minimum-example/100-minimum-sfc' },
        ],
      },
      {
        text: '基礎虛擬 DOM',
        collapsed: false,
        items: [
          { text: '什麼是虛擬 DOM', link: '/zh-tw/20-basic-virtual-dom/010-what-is-virtual-dom' },
          { text: '簡單虛擬 DOM', link: '/zh-tw/20-basic-virtual-dom/020-simple-virtual-dom' },
          { text: '補丁子元素', link: '/zh-tw/20-basic-virtual-dom/030-patch-children' },
          { text: '調度器', link: '/zh-tw/20-basic-virtual-dom/040-scheduler' },
        ],
      },
      {
        text: '基礎響應式系統',
        collapsed: false,
        items: [
          { text: 'ref 和 reactive', link: '/zh-tw/30-basic-reactivity-system/010-ref-reactive' },
          { text: 'computed', link: '/zh-tw/30-basic-reactivity-system/020-computed' },
          { text: 'watch', link: '/zh-tw/30-basic-reactivity-system/030-watch' },
          { text: 'effect 作用域', link: '/zh-tw/30-basic-reactivity-system/040-effect-scope' },
          { text: '其他 API', link: '/zh-tw/30-basic-reactivity-system/050-other-apis' },
          { text: '代理處理器', link: '/zh-tw/30-basic-reactivity-system/060-proxy-handler' },
        ],
      },
      {
        text: '基礎組件系統',
        collapsed: false,
        items: [
          { text: '生命週期', link: '/zh-tw/40-basic-component-system/010-lifecycle' },
          { text: 'provide/inject', link: '/zh-tw/40-basic-component-system/020-provide-inject' },
          { text: '組件代理', link: '/zh-tw/40-basic-component-system/030-component-proxy' },
          { text: '組件插槽', link: '/zh-tw/40-basic-component-system/040-component-slot' },
          { text: '組件事件', link: '/zh-tw/40-basic-component-system/050-component-emit' },
        ],
      },
      {
        text: '基礎模板編譯器',
        collapsed: false,
        items: [
          { text: '轉換', link: '/zh-tw/50-basic-template-compiler/010-transform' },
          { text: 'v-bind', link: '/zh-tw/50-basic-template-compiler/020-v-bind' },
          { text: '轉換表達式', link: '/zh-tw/50-basic-template-compiler/022-transform-expression' },
          { text: 'v-on', link: '/zh-tw/50-basic-template-compiler/025-v-on' },
          { text: '事件修飾符', link: '/zh-tw/50-basic-template-compiler/027-event-modifier' },
          { text: 'Fragment', link: '/zh-tw/50-basic-template-compiler/030-fragment' },
          { text: '註釋', link: '/zh-tw/50-basic-template-compiler/035-comment' },
          { text: 'v-if 和結構指令', link: '/zh-tw/50-basic-template-compiler/040-v-if-and-structural-directive' },
          { text: 'v-for', link: '/zh-tw/50-basic-template-compiler/050-v-for' },
          { text: '解析組件', link: '/zh-tw/50-basic-template-compiler/070-resolve-component' },
          { text: '組件插槽', link: '/zh-tw/50-basic-template-compiler/080-component-slot-outlet' },
        ],
      },
      {
        text: '基礎 SFC 編譯器',
        collapsed: false,
        items: [
          { text: 'script setup', link: '/zh-tw/60-basic-sfc-compiler/010-script-setup' },
          { text: 'defineProps', link: '/zh-tw/60-basic-sfc-compiler/020-define-props' },
          { text: 'defineEmits', link: '/zh-tw/60-basic-sfc-compiler/030-define-emits' },
          { text: '作用域 CSS', link: '/zh-tw/60-basic-sfc-compiler/040-scoped-css' },
        ],
      },
      {
        text: 'Web 應用程式要點',
        collapsed: false,
        items: [
          {
            text: '外掛',
            collapsed: false,
            items: [
              { text: '路由器', link: '/zh-tw/90-web-application-essentials/010-plugins/010-router' },
              { text: '預處理器', link: '/zh-tw/90-web-application-essentials/010-plugins/020-preprocessors' },
            ],
          },
          {
            text: 'SSR',
            collapsed: false,
            items: [
              { text: '建立 SSR 應用', link: '/zh-tw/90-web-application-essentials/020-ssr/010-create-ssr-app' },
              { text: '水合', link: '/zh-tw/90-web-application-essentials/020-ssr/020-hydration' },
            ],
          },
          {
            text: '內建組件',
            collapsed: false,
            items: [
              { text: 'KeepAlive', link: '/zh-tw/90-web-application-essentials/030-builtins/010-keep-alive' },
              { text: 'Suspense', link: '/zh-tw/90-web-application-essentials/030-builtins/020-suspense' },
              { text: 'Transition', link: '/zh-tw/90-web-application-essentials/030-builtins/030-transition' },
            ],
          },
          {
            text: '最佳化',
            collapsed: false,
            items: [
              { text: '靜態提升', link: '/zh-tw/90-web-application-essentials/040-optimizations/010-static-hoisting' },
              { text: '補丁標誌', link: '/zh-tw/90-web-application-essentials/040-optimizations/020-patch-flags' },
              { text: '樹扁平化', link: '/zh-tw/90-web-application-essentials/040-optimizations/030-tree-flattening' },
            ],
          },
        ],
      },
      {
        text: '附錄',
        collapsed: false,
        items: [
          { text: '除錯 Vue.js 核心', link: '/zh-tw/bonus/debug-vuejs-core' },
          {
            text: 'Hyper Ultimate Super Extreme Minimal Vue',
            collapsed: false,
            items: [
              { text: '介紹', link: '/zh-tw/bonus/hyper-ultimate-super-extreme-minimal-vue/index' },
              { text: '15分鐘實現', link: '/zh-tw/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl' },
            ],
          },
        ],
      },
    ],
    editLink: {
      pattern: 'https://github.com/chibivue-land/chibivue/blob/main/book/online-book/src/:path',
      text: '在 GitHub 上編輯此頁面',
    },
    footer: {
      message: '基於 MIT 許可證發布。',
      copyright: 'Copyright © 2023-present ubugeeei',
    },
    docFooter: {
      prev: '上一頁',
      next: '下一頁',
    },
    outline: {
      label: '頁面導航',
    },
    lastUpdated: {
      text: '最後更新於',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium',
      },
    },
    langMenuLabel: '多語言',
    returnToTopLabel: '回到頂部',
    sidebarMenuLabel: '選單',
    darkModeSwitchLabel: '主題',
    lightModeSwitchTitle: '切換到淺色模式',
    darkModeSwitchTitle: '切換到深色模式',
  },
})
