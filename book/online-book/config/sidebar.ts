import type { SidebarItem } from "@ox-content/vite-plugin";

/**
 * Book table of contents. Labels are keyed by locale; links point at the
 * English source and resolve to the sibling page of the current locale.
 */
export const sidebar: SidebarItem[] = [
  {
    text: {
      en: "Getting Started",
      ja: "Getting Started",
      "zh-cn": "入门指南",
      "zh-tw": "入門指南",
    },
    collapsed: false,
    items: [
      {
        text: {
          en: "Getting Started",
          ja: "初めに",
          "zh-cn": "入门指南",
          "zh-tw": "入門指南",
        },
        link: "/00-introduction/010-about.md",
      },
      {
        text: {
          en: "What is Vue.js?",
          ja: "Vue.jsとは",
          "zh-cn": "什么是 Vue.js？",
          "zh-tw": "什麼是 Vue.js？",
        },
        link: "/00-introduction/020-what-is-vue.md",
      },
      {
        text: {
          en: "Key Elements of Vue.js",
          ja: "Vue.jsを構成する主要な要素",
          "zh-cn": "Vue.js 的关键要素",
          "zh-tw": "Vue.js 的關鍵要素",
        },
        link: "/00-introduction/030-vue-core-components.md",
      },
      {
        text: {
          en: "Approach in This Book and Setting Up the Environment",
          ja: "本書の進め方と環境構築",
          "zh-cn": "本书的方法和环境设置",
          "zh-tw": "本書的方法和環境設定",
        },
        link: "/00-introduction/040-setup-project.md",
      },
    ],
  },
  {
    text: {
      en: "Minimum Example",
      ja: "Minimum Example",
      "zh-cn": "最小示例",
      "zh-tw": "最小示例",
    },
    collapsed: false,
    items: [
      {
        text: {
          en: "First Rendering and the createApp API",
          ja: "初めてのレンダリングと createApp API",
          "zh-cn": "第一次渲染和 createApp API",
          "zh-tw": "第一次渲染和 createApp API",
        },
        link: "/10-minimum-example/010-create-app-api.md",
      },
      {
        text: {
          en: "Package Architecture",
          ja: "パッケージの設計",
          "zh-cn": "包架构",
          "zh-tw": "套件架構",
        },
        link: "/10-minimum-example/015-package-architecture.md",
      },
      {
        text: {
          en: "Let's Enable Rendering HTML Elements",
          ja: "HTML要素をレンダリングできるようにしよう",
          "zh-cn": "让我们启用 HTML 元素渲染",
          "zh-tw": "讓我們啟用 HTML 元素渲染",
        },
        link: "/10-minimum-example/020-simple-h-function.md",
      },
      {
        text: {
          en: "Let's work on supporting event handlers and attributes.",
          ja: "イベントハンドラや属性に対応してみる",
          "zh-cn": "让我们支持事件处理器和属性",
          "zh-tw": "讓我們支援事件處理器和屬性",
        },
        link: "/10-minimum-example/025-event-handler-and-attrs.md",
      },
      {
        text: {
          en: "Prerequisite Knowledge for the Reactivity System",
          ja: "リアクティビティシステムの前程知識",
          "zh-cn": "响应式系统的前置知识",
          "zh-tw": "響應式系統的前置知識",
        },
        link: "/10-minimum-example/030-prerequisite-knowledge-for-the-reactivity-system.md",
      },
      {
        text: {
          en: "Try Implementing a Small Reactivity System",
          ja: "小さいリアクティビティシステムを実装してみる",
          "zh-cn": "尝试实现一个小型响应式系统",
          "zh-tw": "嘗試實作一個小型響應式系統",
        },
        link: "/10-minimum-example/035-try-implementing-a-minimum-reactivity-system.md",
      },
      {
        text: {
          en: "A Minimal Virtual DOM",
          ja: "小さい仮想 DOM",
          "zh-cn": "最小虚拟 DOM",
          "zh-tw": "最小虛擬 DOM",
        },
        link: "/10-minimum-example/040-minimum-virtual-dom.md",
      },
      {
        text: {
          en: "Aspiring for Component-Oriented Development",
          ja: "コンポーネント指向で開発したい",
          "zh-cn": "追求组件导向开发",
          "zh-tw": "邁向元件導向開發",
        },
        link: "/10-minimum-example/050-minimum-component.md",
      },
      {
        text: {
          en: "Component Props",
          ja: "Props の実装",
          "zh-cn": "组件 Props",
          "zh-tw": "元件 Props",
        },
        link: "/10-minimum-example/051-component-props.md",
      },
      {
        text: {
          en: "Component Emit",
          ja: "Emit の実装",
          "zh-cn": "组件事件",
          "zh-tw": "元件事件",
        },
        link: "/10-minimum-example/052-component-emits.md",
      },
      {
        text: {
          en: "Understanding the Template Compiler",
          ja: "テンプレートコンパイラを理解する",
          "zh-cn": "理解模板编译器",
          "zh-tw": "理解模板編譯器",
        },
        link: "/10-minimum-example/060-template-compiler.md",
      },
      {
        text: {
          en: "Implementing the Template Compiler",
          ja: "テンプレートコンパイラを実装する",
          "zh-cn": "实现模板编译器",
          "zh-tw": "實作模板編譯器",
        },
        link: "/10-minimum-example/061-template-compiler-impl.md",
      },
      {
        text: {
          en: "Desire to Write More Complex HTML",
          ja: "もっと複雑な HTML を書きたい",
          "zh-cn": "希望编写更复杂的 HTML",
          "zh-tw": "希望編寫更複雜的 HTML",
        },
        link: "/10-minimum-example/070-more-complex-parser.md",
      },
      {
        text: {
          en: "Data Binding",
          ja: "データバインディング",
          "zh-cn": "数据绑定",
          "zh-tw": "資料綁定",
        },
        link: "/10-minimum-example/080-template-binding.md",
      },
      {
        text: {
          en: "Developing with SFC (Peripheral Knowledge)",
          ja: "SFC で開発したい (周辺知識編)",
          "zh-cn": "使用 SFC 开发（外围知识）",
          "zh-tw": "使用 SFC 開發（外圍知識）",
        },
        link: "/10-minimum-example/090-prerequisite-knowledge-for-the-sfc.md",
      },
      {
        text: {
          en: "Parse SFC",
          ja: "SFC のパース",
          "zh-cn": "解析 SFC",
          "zh-tw": "解析 SFC",
        },
        link: "/10-minimum-example/091-parse-sfc.md",
      },
      {
        text: {
          en: "SFC template block",
          ja: "SFC の template block",
          "zh-cn": "SFC template 块",
          "zh-tw": "SFC template 區塊",
        },
        link: "/10-minimum-example/092-compile-sfc-template.md",
      },
      {
        text: {
          en: "SFC script block ",
          ja: "SFC の script block",
          "zh-cn": "SFC script 块",
          "zh-tw": "SFC script 區塊",
        },
        link: "/10-minimum-example/093-compile-sfc-script.md",
      },
      {
        text: {
          en: "SFC style block",
          ja: "SFC の style block",
          "zh-cn": "SFC style 块",
          "zh-tw": "SFC style 區塊",
        },
        link: "/10-minimum-example/094-compile-sfc-style.md",
      },
      {
        text: {
          en: "Taking a Short Break",
          ja: "ちょっと一息",
          "zh-cn": "稍作休息",
          "zh-tw": "稍作休息",
        },
        link: "/10-minimum-example/100-break.md",
      },
    ],
  },
  {
    text: {
      en: "Basic Virtual DOM",
      ja: "Basic Virtual DOM",
      "zh-cn": "基础虚拟 DOM",
      "zh-tw": "基礎虛擬 DOM",
    },
    collapsed: false,
    items: [
      {
        text: {
          en: "key Attribute and Patch Rendering",
          ja: "key属性とパッチレンダリング",
          "zh-cn": "key 属性和补丁渲染",
          "zh-tw": "key 屬性和補丁渲染",
        },
        link: "/20-basic-virtual-dom/010-patch-keyed-children.md",
      },
      {
        text: {
          en: "Bit-Level Representation of VNodes",
          ja: "ビットによるVNodeの表現",
          "zh-cn": "VNode 的位级表示",
          "zh-tw": "VNode 的位元級表示",
        },
        link: "/20-basic-virtual-dom/020-bit-flags.md",
      },
      {
        text: {
          en: "Scheduler",
          ja: "スケジューラ",
          "zh-cn": "调度器",
          "zh-tw": "調度器",
        },
        link: "/20-basic-virtual-dom/030-scheduler.md",
      },
      {
        text: {
          en: "Patch for Unhandled Props",
          ja: "対応できていない Props のパッチ",
          "zh-cn": "未处理 Props 的补丁",
          "zh-tw": "未處理 Props 的補丁",
        },
        link: "/20-basic-virtual-dom/040-patch-other-attrs.md",
      },
    ],
  },
  {
    text: {
      en: "Basic Reactivity System",
      ja: "Basic Reactivity System",
      "zh-cn": "基础响应式系统",
      "zh-tw": "基礎響應式系統",
    },
    collapsed: false,
    items: [
      {
        text: {
          en: "Reactivity Optimization",
          ja: "Reactivity の最適化",
          "zh-cn": "响应式优化",
          "zh-tw": "響應式最佳化",
        },
        link: "/30-basic-reactivity-system/005-reactivity-optimization.md",
      },
      {
        text: {
          en: "ref API",
          ja: "ref api",
          "zh-cn": "ref API",
          "zh-tw": "ref API",
        },
        link: "/30-basic-reactivity-system/010-ref-api.md",
      },
      {
        text: {
          en: "computed / watch API",
          ja: "computed / watch api",
          "zh-cn": "computed / watch API",
          "zh-tw": "computed / watch API",
        },
        link: "/30-basic-reactivity-system/020-computed-watch.md",
      },
      {
        text: {
          en: "Various Reactive Proxy Handlers",
          ja: "様々な Reactive Proxy Handler",
          "zh-cn": "各种响应式代理处理器",
          "zh-tw": "各種響應式代理處理器",
        },
        link: "/30-basic-reactivity-system/030-reactive-proxy-handlers.md",
      },
      {
        text: {
          en: "Effect Cleanup and Effect Scope",
          ja: "Effect のクリーンアップと Effect Scope",
          "zh-cn": "Effect 清理和 Effect 作用域",
          "zh-tw": "Effect 清理和 Effect 作用域",
        },
        link: "/30-basic-reactivity-system/040-effect-scope.md",
      },
      {
        text: {
          en: "Other Reactivity APIs",
          ja: "その他の reactivity api",
          "zh-cn": "其他响应式 API",
          "zh-tw": "其他響應式 API",
        },
        link: "/30-basic-reactivity-system/050-other-apis.md",
      },
    ],
  },
  {
    text: {
      en: "Basic Component System",
      ja: "Basic Component System",
      "zh-cn": "基础组件系统",
      "zh-tw": "基礎元件系統",
    },
    collapsed: false,
    items: [
      {
        text: {
          en: "Lifecycle Hooks",
          ja: "ライフサイクルフック",
          "zh-cn": "生命周期钩子",
          "zh-tw": "生命週期鉤子",
        },
        link: "/40-basic-component-system/010-lifecycle-hooks.md",
      },
      {
        text: "Provide/Inject",
        link: "/40-basic-component-system/020-provide-inject.md",
      },
      {
        text: {
          en: "Component Proxies and setupContext",
          ja: "コンポーネントの Proxy と setupContext",
          "zh-cn": "组件代理和 setupContext",
          "zh-tw": "元件代理和 setupContext",
        },
        link: "/40-basic-component-system/030-component-proxy-setup-context.md",
      },
      {
        text: {
          en: "Slots",
          ja: "スロット",
          "zh-cn": "插槽",
          "zh-tw": "插槽",
        },
        link: "/40-basic-component-system/040-component-slot.md",
      },
      {
        text: {
          en: "Supporting Options API",
          ja: "Options APIに対応する",
          "zh-cn": "支持 Options API",
          "zh-tw": "支援 Options API",
        },
        link: "/40-basic-component-system/050-options-api.md",
      },
    ],
  },
  {
    text: {
      en: "Basic Template Compiler",
      ja: "Basic Template Compiler",
      "zh-cn": "基础模板编译器",
      "zh-tw": "基礎模板編譯器",
    },
    collapsed: false,
    items: [
      {
        text: {
          en: "Refactoring Implementation of Transformer for Codegen",
          ja: "Transformer の実装 の Codegen のリファクタ",
          "zh-cn": "重构 Transformer 的 Codegen 实现",
          "zh-tw": "重構 Transformer 的 Codegen 實作",
        },
        link: "/50-basic-template-compiler/010-transform.md",
      },
      {
        text: {
          en: "Implementing Directives (v-bind)",
          ja: "ディレクティブを実装しよう (v-bind)",
          "zh-cn": "实现指令（v-bind）",
          "zh-tw": "實作指令（v-bind）",
        },
        link: "/50-basic-template-compiler/020-v-bind.md",
      },
      {
        text: {
          en: "Eval expression in template",
          ja: "template 内での式の評価",
          "zh-cn": "在模板中求值表达式",
          "zh-tw": "在模板中求值運算式",
        },
        link: "/50-basic-template-compiler/022-transform-expression.md",
      },
      {
        text: {
          en: "Supporting v-on",
          ja: "v-on に対応する",
          "zh-cn": "支持 v-on",
          "zh-tw": "支援 v-on",
        },
        link: "/50-basic-template-compiler/025-v-on.md",
      },
      {
        text: {
          en: "compiler-dom and Event Modifiers",
          ja: "compiler-dom とイベント修飾子",
          "zh-cn": "compiler-dom 和事件修饰符",
          "zh-tw": "compiler-dom 和事件修飾符",
        },
        link: "/50-basic-template-compiler/027-event-modifier.md",
      },
      {
        text: {
          en: "Support for Fragment",
          ja: "Fragment に対応する",
          "zh-cn": "支持 Fragment",
          "zh-tw": "支援 Fragment",
        },
        link: "/50-basic-template-compiler/030-fragment.md",
      },
      {
        text: {
          en: "Support for Comment Node",
          ja: "コメントアウトに対応する",
          "zh-cn": "支持注释节点",
          "zh-tw": "支援註釋節點",
        },
        link: "/50-basic-template-compiler/035-comment.md",
      },
      {
        text: {
          en: "v-if and Structural Directives",
          ja: "v-if と構造的ディレクティブ",
          "zh-cn": "v-if 和结构指令",
          "zh-tw": "v-if 和結構指令",
        },
        link: "/50-basic-template-compiler/040-v-if-and-structural-directive.md",
      },
      {
        text: {
          en: "Support for v-for",
          ja: "v-for に対応する",
          "zh-cn": "支持 v-for",
          "zh-tw": "支援 v-for",
        },
        link: "/50-basic-template-compiler/050-v-for.md",
      },
      {
        text: {
          en: "Resolving Components",
          ja: "コンポーネントを解決する",
          "zh-cn": "解析组件",
          "zh-tw": "解析元件",
        },
        link: "/50-basic-template-compiler/070-resolve-component.md",
      },
      {
        text: {
          en: "Support for Slots (Definition)",
          ja: "スロットに対応する (定義編)",
          "zh-cn": "支持插槽（定义）",
          "zh-tw": "支援插槽（定義）",
        },
        link: "/50-basic-template-compiler/080-component-slot-outlet.md",
      },
      {
        text: {
          en: "Support for Slots (Usage)",
          ja: "スロットに対応する (利用編)",
          "zh-cn": "支持插槽（使用）",
          "zh-tw": "支援插槽（使用）",
        },
        link: "/50-basic-template-compiler/085-component-slot-insert.md",
      },
      {
        text: {
          en: "Other Directives",
          ja: "その他のディレクティブ",
          "zh-cn": "其他指令",
          "zh-tw": "其他指令",
        },
        link: "/50-basic-template-compiler/090-other-directives.md",
      },
      {
        text: {
          en: "Compiler Refinements",
          ja: "コンパイラの細かい調整",
          "zh-cn": "编译器细节优化",
          "zh-tw": "編譯器細節最佳化",
        },
        link: "/50-basic-template-compiler/100-chore-compiler.md",
      },
      {
        text: {
          en: "Parser Optimization",
          ja: "パーサーの最適化",
          "zh-cn": "解析器优化",
          "zh-tw": "解析器最佳化",
        },
        link: "/50-basic-template-compiler/110-parser-optimization.md",
      },
      {
        text: {
          en: "Custom Directives",
          ja: "カスタムディレクティブ",
          "zh-cn": "自定义指令",
          "zh-tw": "自訂指令",
        },
        link: "/50-basic-template-compiler/500-custom-directive.md",
      },
    ],
  },
  {
    text: {
      en: "Basic SFC Compiler",
      ja: "Basic SFC Compiler",
      "zh-cn": "基础 SFC 编译器",
      "zh-tw": "基礎 SFC 編譯器",
    },
    collapsed: false,
    items: [
      {
        text: {
          en: "Supporting script setup",
          ja: "script setup に対応する",
          "zh-cn": "支持 script setup",
          "zh-tw": "支援 script setup",
        },
        link: "/60-basic-sfc-compiler/010-script-setup.md",
      },
      {
        text: {
          en: "Supporting defineProps",
          ja: "defineProps に対応する",
          "zh-cn": "支持 defineProps",
          "zh-tw": "支援 defineProps",
        },
        link: "/60-basic-sfc-compiler/020-define-props.md",
      },
      {
        text: {
          en: "Supporting defineEmits",
          ja: "defineEmits に対応する",
          "zh-cn": "支持 defineEmits",
          "zh-tw": "支援 defineEmits",
        },
        link: "/60-basic-sfc-compiler/030-define-emits.md",
      },
      {
        text: {
          en: "Supporting Scoped CSS",
          ja: "Scoped CSS に対応する",
          "zh-cn": "支持作用域 CSS",
          "zh-tw": "支援作用域 CSS",
        },
        link: "/60-basic-sfc-compiler/040-scoped-css.md",
      },
      {
        text: {
          en: "Supporting Props Destructure",
          ja: "Props の分割代入に対応する",
          "zh-cn": "支持 Props 解构",
          "zh-tw": "支援 Props 解構",
        },
        link: "/60-basic-sfc-compiler/050-props-destructure.md",
      },
      {
        text: {
          en: "Type-based defineProps/defineEmits",
          ja: "型ベースの defineProps/defineEmits",
          "zh-cn": "基于类型的 defineProps/defineEmits",
          "zh-tw": "基於型別的 defineProps/defineEmits",
        },
        link: "/60-basic-sfc-compiler/060-type-based-macros.md",
      },
    ],
  },
  {
    text: {
      en: "Web Application Essentials",
      ja: "Web Application Essentials",
      "zh-cn": "Web 应用程序要点",
      "zh-tw": "Web 應用程式要點",
    },
    collapsed: false,
    items: [
      {
        text: {
          en: "Plugins",
          ja: "プラグイン",
          "zh-cn": "插件",
          "zh-tw": "外掛",
        },
        collapsed: false,
        items: [
          {
            text: {
              en: "Router",
              ja: "ルーター",
              "zh-cn": "路由器",
              "zh-tw": "路由器",
            },
            link: "/90-web-application-essentials/010-plugins/010-router.md",
          },
          {
            text: {
              en: "CSS Preprocessors",
              ja: "CSS プリプロセッサ",
              "zh-cn": "CSS 预处理器",
              "zh-tw": "CSS 預處理器",
            },
            link: "/90-web-application-essentials/010-plugins/020-preprocessors.md",
          },
          {
            text: {
              en: "Store",
              ja: "ストア",
              "zh-cn": "状态管理",
              "zh-tw": "狀態管理",
            },
            link: "/90-web-application-essentials/010-plugins/020-store.md",
          },
          {
            text: {
              en: "Data Fetch",
              ja: "データフェッチ",
              "zh-cn": "数据获取",
              "zh-tw": "資料擷取",
            },
            link: "/90-web-application-essentials/010-plugins/030-data-fetch.md",
          },
          {
            text: "Language Tools",
            link: "/90-web-application-essentials/010-plugins/040-language-tools.md",
          },
        ],
      },
      {
        text: {
          en: "Server Side Rendering",
          ja: "Server Side Rendering",
          "zh-cn": "服务端渲染",
          "zh-tw": "伺服器端渲染",
        },
        collapsed: false,
        items: [
          {
            text: "renderToString",
            link: "/90-web-application-essentials/020-ssr/010-create-ssr-app.md",
          },
          {
            text: {
              en: "Hydration",
              ja: "Hydration",
              "zh-cn": "Hydration（水合）",
              "zh-tw": "Hydration（水合）",
            },
            link: "/90-web-application-essentials/020-ssr/020-hydration.md",
          },
          {
            text: "Compiler SSR",
            link: "/90-web-application-essentials/020-ssr/030-compiler-ssr.md",
          },
        ],
      },
      {
        text: {
          en: "Built-in Components",
          ja: "組み込みコンポーネント",
          "zh-cn": "内置组件",
          "zh-tw": "內建元件",
        },
        collapsed: false,
        items: [
          {
            text: "KeepAlive",
            link: "/90-web-application-essentials/030-builtins/010-keep-alive.md",
          },
          {
            text: "Transition",
            link: "/90-web-application-essentials/030-builtins/030-transition.md",
          },
        ],
      },
      {
        text: {
          en: "Optimizations",
          ja: "最適化",
          "zh-cn": "优化",
          "zh-tw": "最佳化",
        },
        collapsed: false,
        items: [
          {
            text: {
              en: "Static Hoisting",
              ja: "Static Hoisting",
              "zh-cn": "静态提升",
              "zh-tw": "靜態提升",
            },
            link: "/90-web-application-essentials/040-optimizations/010-static-hoisting.md",
          },
          {
            text: {
              en: "Patch Flags",
              ja: "Patch Flags",
              "zh-cn": "补丁标志",
              "zh-tw": "補丁標誌",
            },
            link: "/90-web-application-essentials/040-optimizations/020-patch-flags.md",
          },
          {
            text: {
              en: "Tree Flattening",
              ja: "Tree Flattening",
              "zh-cn": "树扁平化",
              "zh-tw": "樹扁平化",
            },
            link: "/90-web-application-essentials/040-optimizations/030-tree-flattening.md",
          },
        ],
      },
      {
        text: {
          en: "Vapor Mode",
          ja: "Vapor Mode",
          "zh-cn": "Vapor 模式",
          "zh-tw": "Vapor 模式",
        },
        collapsed: false,
        items: [
          {
            text: {
              en: "Vapor Mode",
              ja: "Vapor Mode",
              "zh-cn": "Vapor 模式",
              "zh-tw": "Vapor 模式",
            },
            link: "/90-web-application-essentials/050-vapor/010-introduction.md",
          },
          {
            text: {
              en: "Vapor Compiler",
              ja: "Vapor Compiler",
              "zh-cn": "Vapor 编译器",
              "zh-tw": "Vapor 編譯器",
            },
            link: "/90-web-application-essentials/050-vapor/020-vapor-compiler.md",
          },
          {
            text: "Vapor SSR",
            link: "/90-web-application-essentials/050-vapor/030-vapor-ssr.md",
          },
        ],
      },
    ],
  },
  {
    text: {
      en: "Appendix",
      ja: "付録",
      "zh-cn": "附录",
      "zh-tw": "附錄",
    },
    collapsed: false,
    items: [
      {
        text: {
          en: "Hot Paths",
          ja: "Hot Paths",
          "zh-cn": "快速学习路线",
          "zh-tw": "快速學習路線",
        },
        collapsed: false,
        items: [
          {
            text: {
              en: "Overview",
              ja: "概要",
              "zh-cn": "路线概览",
              "zh-tw": "路線概覽",
            },
            link: "/bonus/hot-paths/index.md",
          },
          {
            text: {
              en: "Beginner 30-minute hands-on",
              ja: "初心者向け 30 分ハンズオン",
              "zh-cn": "初学者 30 分钟动手实践",
              "zh-tw": "初學者 30 分鐘動手實作",
            },
            link: "/bonus/hot-paths/beginner-30-min-hands-on.md",
          },
          {
            text: {
              en: "Beginner 60-minute hands-on",
              ja: "初心者向け 1 時間ハンズオン",
              "zh-cn": "初学者 60 分钟动手实践",
              "zh-tw": "初學者 60 分鐘動手實作",
            },
            link: "/bonus/hot-paths/beginner-60-min-hands-on.md",
          },
          {
            text: {
              en: "Intermediate 60-minute hands-on",
              ja: "中級者向け 1 時間ハンズオン",
              "zh-cn": "进阶 60 分钟动手实践",
              "zh-tw": "進階 60 分鐘動手實作",
            },
            link: "/bonus/hot-paths/intermediate-60-min-hands-on.md",
          },
          {
            text: {
              en: "Advanced 30-minute summary",
              ja: "上級者向け 30 分サマリ",
              "zh-cn": "高级 30 分钟概要",
              "zh-tw": "高階 30 分鐘概要",
            },
            link: "/bonus/hot-paths/advanced-30-min-summary.md",
          },
        ],
      },
      {
        text: {
          en: "Writing Vue.js in 15 minutes.",
          ja: "15 分で Vue を作る",
          "zh-cn": "15分钟编写 Vue.js",
          "zh-tw": "15分鐘編寫 Vue.js",
        },
        collapsed: false,
        items: [
          {
            text: {
              en: "chibivue, isn't it small...?",
              ja: "chibivue、デカくないですか...?",
              "zh-cn": "chibivue，不是很小吗...？",
              "zh-tw": "chibivue，不是很小嗎...？",
            },
            link: "/bonus/hyper-ultimate-super-extreme-minimal-vue/index.md",
          },
          {
            text: {
              en: "Implement",
              ja: "実装",
              "zh-cn": "实现",
              "zh-tw": "實作",
            },
            link: "/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl.md",
          },
        ],
      },
      {
        text: {
          en: "debug original Vue.js source",
          ja: "本家のソースコードをデバッグする",
          "zh-cn": "调试原始 Vue.js 源码",
          "zh-tw": "除錯 Vue.js 原始碼",
        },
        link: "/bonus/debug-vuejs-core.md",
      },
    ],
  },
];
