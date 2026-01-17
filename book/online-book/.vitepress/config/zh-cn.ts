import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";

export const zhCnConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  themeConfig: {
    nav: [
      { text: "首页", link: "/zh-cn/" },
      { text: "开始学习", link: "/zh-cn/00-introduction/010-about" },
    ],
    sidebar: [
      {
        text: "入门指南",
        collapsed: false,
        items: [
          { text: "入门指南", link: "/zh-cn/00-introduction/010-about" },
          {
            text: "什么是 Vue.js？",
            link: "/zh-cn/00-introduction/020-what-is-vue",
          },
          {
            text: "Vue.js 的关键要素",
            link: "/zh-cn/00-introduction/030-vue-core-components",
          },
          {
            text: "本书的方法和环境设置",
            link: "/zh-cn/00-introduction/040-setup-project",
          },
        ],
      },
      {
        text: "最小示例",
        collapsed: false,
        items: [
          {
            text: "第一次渲染和 createApp API",
            link: "/zh-cn/10-minimum-example/010-create-app-api",
          },
          {
            text: "包架构",
            link: "/zh-cn/10-minimum-example/015-package-architecture",
          },
          {
            text: "让我们启用 HTML 元素渲染",
            link: "/zh-cn/10-minimum-example/020-simple-h-function",
          },
          {
            text: "让我们支持事件处理器和属性",
            link: "/zh-cn/10-minimum-example/025-event-handler-and-attrs",
          },
          {
            text: "响应式系统的前置知识",
            link: "/zh-cn/10-minimum-example/030-prerequisite-knowledge-for-the-reactivity-system",
          },
          {
            text: "尝试实现一个小型响应式系统",
            link: "/zh-cn/10-minimum-example/035-try-implementing-a-minimum-reactivity-system",
          },
          {
            text: "最小虚拟 DOM",
            link: "/zh-cn/10-minimum-example/040-minimum-virtual-dom",
          },
          {
            text: "追求组件导向开发",
            link: "/zh-cn/10-minimum-example/050-minimum-component",
          },
          {
            text: "组件 Props",
            link: "/zh-cn/10-minimum-example/051-component-props",
          },
          {
            text: "组件 Emit",
            link: "/zh-cn/10-minimum-example/052-component-emits",
          },
          {
            text: "理解模板编译器",
            link: "/zh-cn/10-minimum-example/060-template-compiler",
          },
          {
            text: "实现模板编译器",
            link: "/zh-cn/10-minimum-example/061-template-compiler-impl",
          },
          {
            text: "希望编写更复杂的 HTML",
            link: "/zh-cn/10-minimum-example/070-more-complex-parser",
          },
          {
            text: "数据绑定",
            link: "/zh-cn/10-minimum-example/080-template-binding",
          },
          {
            text: "使用 SFC 开发（外围知识）",
            link: "/zh-cn/10-minimum-example/090-prerequisite-knowledge-for-the-sfc",
          },
          {
            text: "解析 SFC",
            link: "/zh-cn/10-minimum-example/091-parse-sfc",
          },
          {
            text: "SFC template 块",
            link: "/zh-cn/10-minimum-example/092-compile-sfc-template",
          },
          {
            text: "SFC script 块",
            link: "/zh-cn/10-minimum-example/093-compile-sfc-script",
          },
          {
            text: "SFC style 块",
            link: "/zh-cn/10-minimum-example/094-compile-sfc-style",
          },
          {
            text: "稍作休息",
            link: "/zh-cn/10-minimum-example/100-break",
          },
        ],
      },
      {
        text: "基础虚拟 DOM",
        collapsed: false,
        items: [
          {
            text: "key 属性和补丁渲染",
            link: "/zh-cn/20-basic-virtual-dom/010-patch-keyed-children",
          },
          {
            text: "VNode 的位级表示",
            link: "/zh-cn/20-basic-virtual-dom/020-bit-flags",
          },
          {
            text: "调度器",
            link: "/zh-cn/20-basic-virtual-dom/030-scheduler",
          },
          {
            text: "🚧 未处理 Props 的补丁",
            link: "/zh-cn/20-basic-virtual-dom/040-patch-other-attrs",
          },
        ],
      },
      {
        text: "基础响应式系统",
        collapsed: false,
        items: [
          {
            text: "🚧 响应式优化",
            link: "/zh-cn/30-basic-reactivity-system/005-reactivity-optimization",
          },
          {
            text: "ref API",
            link: "/zh-cn/30-basic-reactivity-system/010-ref-api",
          },
          {
            text: "computed / watch API",
            link: "/zh-cn/30-basic-reactivity-system/020-computed-watch",
          },
          {
            text: "各种响应式代理处理器",
            link: "/zh-cn/30-basic-reactivity-system/030-reactive-proxy-handlers",
          },
          {
            text: "Effect 清理和 Effect 作用域",
            link: "/zh-cn/30-basic-reactivity-system/040-effect-scope",
          },
          {
            text: "其他响应式 API",
            link: "/zh-cn/30-basic-reactivity-system/050-other-apis",
          },
        ],
      },
      {
        text: "基础组件系统",
        collapsed: false,
        items: [
          {
            text: "生命周期钩子",
            link: "/zh-cn/40-basic-component-system/010-lifecycle-hooks",
          },
          {
            text: "Provide/Inject",
            link: "/zh-cn/40-basic-component-system/020-provide-inject",
          },
          {
            text: "组件代理和 setupContext",
            link: "/zh-cn/40-basic-component-system/030-component-proxy-setup-context",
          },
          {
            text: "插槽",
            link: "/zh-cn/40-basic-component-system/040-component-slot",
          },
          {
            text: "支持 Options API",
            link: "/zh-cn/40-basic-component-system/050-options-api",
          },
        ],
      },
      {
        text: "基础模板编译器",
        collapsed: false,
        items: [
          {
            text: "重构 Transformer 的 Codegen 实现",
            link: "/zh-cn/50-basic-template-compiler/010-transform",
          },
          {
            text: "实现指令（v-bind）",
            link: "/zh-cn/50-basic-template-compiler/020-v-bind",
          },
          {
            text: "在模板中求值表达式",
            link: "/zh-cn/50-basic-template-compiler/022-transform-expression",
          },
          {
            text: "支持 v-on",
            link: "/zh-cn/50-basic-template-compiler/025-v-on",
          },
          {
            text: "compiler-dom 和事件修饰符",
            link: "/zh-cn/50-basic-template-compiler/027-event-modifier",
          },
          {
            text: "支持 Fragment",
            link: "/zh-cn/50-basic-template-compiler/030-fragment",
          },
          {
            text: "支持注释节点",
            link: "/zh-cn/50-basic-template-compiler/035-comment",
          },
          {
            text: "v-if 和结构指令",
            link: "/zh-cn/50-basic-template-compiler/040-v-if-and-structural-directive",
          },
          {
            text: "支持 v-for",
            link: "/zh-cn/50-basic-template-compiler/050-v-for",
          },
          {
            text: "解析组件",
            link: "/zh-cn/50-basic-template-compiler/070-resolve-component",
          },
          {
            text: "支持插槽（定义）",
            link: "/zh-cn/50-basic-template-compiler/080-component-slot-outlet",
          },
          {
            text: "🚧 插槽",
            link: "/zh-cn/50-basic-template-compiler/080-slot",
          },
          {
            text: "🚧 其他指令",
            link: "/zh-cn/50-basic-template-compiler/090-other-directives",
          },
          {
            text: "🚧 编译器细节优化",
            link: "/zh-cn/50-basic-template-compiler/100-chore-compiler",
          },
          {
            text: "🚧 自定义指令",
            link: "/zh-cn/50-basic-template-compiler/500-custom-directive",
          },
        ],
      },
      {
        text: "🚧 基础 SFC 编译器",
        collapsed: true,
        items: [
          {
            text: "支持 script setup",
            link: "/zh-cn/60-basic-sfc-compiler/010-script-setup",
          },
          {
            text: "支持 defineProps",
            link: "/zh-cn/60-basic-sfc-compiler/020-define-props",
          },
          {
            text: "支持 defineEmits",
            link: "/zh-cn/60-basic-sfc-compiler/030-define-emits",
          },
          {
            text: "支持作用域 CSS",
            link: "/zh-cn/60-basic-sfc-compiler/040-scoped-css",
          },
        ],
      },
      {
        text: "🚧 Web 应用程序要点",
        collapsed: true,
        items: [
          {
            text: "🚧 插件",
            collapsed: false,
            items: [
              {
                text: "路由器",
                link: "/zh-cn/90-web-application-essentials/010-plugins/010-router",
              },
              {
                text: "预处理器",
                link: "/zh-cn/90-web-application-essentials/010-plugins/020-preprocessors",
              },
            ],
          },

          {
            text: "🚧 服务端渲染",
            collapsed: false,
            items: [
              {
                text: "createSSRApp",
                link: "/zh-cn/90-web-application-essentials/020-ssr/010-create-ssr-app",
              },
              {
                text: "水合",
                link: "/zh-cn/90-web-application-essentials/020-ssr/020-hydration",
              },
            ],
          },
          {
            text: "🚧 内置组件",
            collapsed: false,
            items: [
              {
                text: "KeepAlive",
                link: "/zh-cn/90-web-application-essentials/030-builtins/010-keep-alive",
              },
              {
                text: "Suspense",
                link: "/zh-cn/90-web-application-essentials/030-builtins/020-suspense",
              },
              {
                text: "Transition",
                link: "/zh-cn/90-web-application-essentials/030-builtins/030-transition",
              },
            ],
          },
          {
            text: "🚧 优化",
            collapsed: false,
            items: [
              {
                text: "静态提升",
                link: "/zh-cn/90-web-application-essentials/040-optimizations/010-static-hoisting",
              },
              {
                text: "补丁标志",
                link: "/zh-cn/90-web-application-essentials/040-optimizations/020-patch-flags",
              },
              {
                text: "树扁平化",
                link: "/zh-cn/90-web-application-essentials/040-optimizations/030-tree-flattening",
              },
            ],
          },
        ],
      },
      {
        text: "附录",
        collapsed: false,
        items: [
          {
            text: "15分钟编写 Vue.js",
            collapsed: true,
            items: [
              {
                text: "chibivue，不是很小吗...？",
                link: "/zh-cn/bonus/hyper-ultimate-super-extreme-minimal-vue/",
              },
              {
                text: "实现",
                link: "/zh-cn/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl",
              },
            ],
          },
          {
            text: "调试原始 Vue.js 源码",
            link: "/zh-cn/bonus/debug-vuejs-core",
          },
        ],
      },
    ],
    editLink: {
      pattern: "https://github.com/chibivue-land/chibivue/blob/main/book/online-book/src/:path",
      text: "在 GitHub 上编辑此页面",
    },
    footer: {
      message: "基于 MIT 许可证发布。",
      copyright: "Copyright © 2023-present ubugeeei",
    },
    docFooter: {
      prev: "上一页",
      next: "下一页",
    },
    outline: {
      label: "页面导航",
    },
    lastUpdated: {
      text: "最后更新于",
      formatOptions: {
        dateStyle: "short",
        timeStyle: "medium",
      },
    },
    langMenuLabel: "多语言",
    returnToTopLabel: "回到顶部",
    sidebarMenuLabel: "菜单",
    darkModeSwitchLabel: "主题",
    lightModeSwitchTitle: "切换到浅色模式",
    darkModeSwitchTitle: "切换到深色模式",
  },
};
