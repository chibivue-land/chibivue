import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";

export const jaConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  themeConfig: {
    nav: [
      { text: "Home", link: "/ja/" },
      { text: "Start Learning", link: "/ja/00-introduction/010-about" },
    ],
    sidebar: [
      {
        text: "Getting Started",
        collapsed: false,
        items: [
          { text: "初めに", link: "/ja/00-introduction/010-about" },
          { text: "Vue.jsとは", link: "/ja/00-introduction/020-what-is-vue" },
          {
            text: "Vue.jsを構成する主要な要素",
            link: "/ja/00-introduction/030-vue-core-components",
          },
          {
            text: "本書の進め方と環境構築",
            link: "/ja/00-introduction/040-setup-project",
          },
        ],
      },
      {
        text: "Minimum Example",
        collapsed: false,
        items: [
          {
            text: "初めてのレンダリングと createApp API",
            link: "/ja/10-minimum-example/010-create-app-api",
          },
          {
            text: "パッケージの設計",
            link: "/ja/10-minimum-example/015-package-architecture",
          },
          {
            text: "HTML要素をレンダリングできるようにしよう",
            link: "/ja/10-minimum-example/020-simple-h-function",
          },
          {
            text: "イベントハンドラや属性に対応してみる",
            link: "/ja/10-minimum-example/025-event-handler-and-attrs",
          },
          {
            text: "リアクティビティシステムの前程知識",
            link: "/ja/10-minimum-example/030-prerequisite-knowledge-for-the-reactivity-system",
          },
          {
            text: "小さいリアクティビティシステムを実装してみる",
            link: "/ja/10-minimum-example/035-try-implementing-a-minimum-reactivity-system",
          },
          {
            text: "小さい仮想 DOM",
            link: "/ja/10-minimum-example/040-minimum-virtual-dom",
          },
          {
            text: "コンポーネント指向で開発したい",
            link: "/ja/10-minimum-example/050-minimum-component",
          },
          {
            text: "Props の実装",
            link: "/ja/10-minimum-example/051-component-props",
          },
          {
            text: "Emit の実装",
            link: "/ja/10-minimum-example/052-component-emits",
          },
          {
            text: "テンプレートコンパイラを理解する",
            link: "/ja/10-minimum-example/060-template-compiler",
          },
          {
            text: "テンプレートコンパイラを実装する",
            link: "/ja/10-minimum-example/061-template-compiler-impl",
          },
          {
            text: "もっと複雑な HTML を書きたい",
            link: "/ja/10-minimum-example/070-more-complex-parser",
          },
          {
            text: "データバインディング",
            link: "/ja/10-minimum-example/080-template-binding",
          },
          {
            text: "SFC で開発したい (周辺知識編)",
            link: "/ja/10-minimum-example/090-prerequisite-knowledge-for-the-sfc",
          },
          {
            text: "SFC のパース",
            link: "/ja/10-minimum-example/091-parse-sfc",
          },
          {
            text: "SFC の template block",
            link: "/ja/10-minimum-example/092-compile-sfc-template",
          },
          {
            text: "SFC の script block",
            link: "/ja/10-minimum-example/093-compile-sfc-script",
          },
          {
            text: "SFC の style block",
            link: "/ja/10-minimum-example/094-compile-sfc-style",
          },
          {
            text: "ちょっと一息",
            link: "/ja/10-minimum-example/100-break",
          },
        ],
      },
      {
        text: "Basic Virtual DOM",
        collapsed: false,
        items: [
          {
            text: "key属性とパッチレンダリング",
            link: "/ja/20-basic-virtual-dom/010-patch-keyed-children",
          },
          {
            text: "ビットによるVNodeの表現",
            link: "/ja/20-basic-virtual-dom/020-bit-flags",
          },
          {
            text: "スケジューラ",
            link: "/ja/20-basic-virtual-dom/030-scheduler",
          },
          {
            text: "対応できていない Props のパッチ",
            link: "/ja/20-basic-virtual-dom/040-patch-other-attrs",
          },
        ],
      },
      {
        text: "Basic Reactivity System",
        collapsed: false,
        items: [
          {
            text: "Reactivity の最適化",
            link: "/ja/30-basic-reactivity-system/005-reactivity-optimization",
          },
          {
            text: "ref api",
            link: "/ja/30-basic-reactivity-system/010-ref-api",
          },
          {
            text: "computed / watch api",
            link: "/ja/30-basic-reactivity-system/020-computed-watch",
          },
          {
            text: "様々な Reactive Proxy Handler",
            link: "/ja/30-basic-reactivity-system/030-reactive-proxy-handlers",
          },
          {
            text: "Effect のクリーンアップと Effect Scope",
            link: "/ja/30-basic-reactivity-system/040-effect-scope",
          },
          {
            text: "その他の reactivity api",
            link: "/ja/30-basic-reactivity-system/050-other-apis",
          },
        ],
      },
      {
        text: "Basic Component System",
        collapsed: false,
        items: [
          {
            text: "ライフサイクルフック",
            link: "/ja/40-basic-component-system/010-lifecycle-hooks",
          },
          {
            text: "Provide/Inject",
            link: "/ja/40-basic-component-system/020-provide-inject",
          },
          {
            text: "コンポーネントの Proxy と setupContext",
            link: "/ja/40-basic-component-system/030-component-proxy-setup-context",
          },
          {
            text: "スロット",
            link: "/ja/40-basic-component-system/040-component-slot",
          },
          {
            text: "Options APIに対応する",
            link: "/ja/40-basic-component-system/050-options-api",
          },
        ],
      },
      {
        text: "Basic Template Compiler",
        collapsed: false,
        items: [
          {
            text: "Transformer の実装 の Codegen のリファクタ",
            link: "/ja/50-basic-template-compiler/010-transform",
          },
          {
            text: "ディレクティブを実装しよう (v-bind)",
            link: "/ja/50-basic-template-compiler/020-v-bind",
          },
          {
            text: "template 内での式の評価",
            link: "/ja/50-basic-template-compiler/022-transform-expression",
          },
          {
            text: "v-on に対応する",
            link: "/ja/50-basic-template-compiler/025-v-on",
          },
          {
            text: "compiler-dom とイベント修飾子",
            link: "/ja/50-basic-template-compiler/027-event-modifier",
          },
          {
            text: "Fragment に対応する",
            link: "/ja/50-basic-template-compiler/030-fragment",
          },
          {
            text: "コメントアウトに対応する",
            link: "/ja/50-basic-template-compiler/035-comment",
          },
          {
            text: "v-if と構造的ディレクティブ",
            link: "/ja/50-basic-template-compiler/040-v-if-and-structural-directive",
          },
          {
            text: "v-for に対応する",
            link: "/ja/50-basic-template-compiler/050-v-for",
          },
          {
            text: "コンポーネントを解決する",
            link: "/ja/50-basic-template-compiler/070-resolve-component",
          },
          {
            text: "スロットに対応する (定義編)",
            link: "/ja/50-basic-template-compiler/080-component-slot-outlet",
          },
          {
            text: "スロットに対応する (利用編)",
            link: "/ja/50-basic-template-compiler/085-component-slot-insert",
          },
          {
            text: "その他のディレクティブ",
            link: "/ja/50-basic-template-compiler/090-other-directives",
          },
          {
            text: "コンパイラの細かい調整",
            link: "/ja/50-basic-template-compiler/100-chore-compiler",
          },
          {
            text: "パーサーの最適化",
            link: "/ja/50-basic-template-compiler/110-parser-optimization",
          },
          {
            text: "カスタムディレクティブ",
            link: "/ja/50-basic-template-compiler/500-custom-directive",
          },
        ],
      },
      {
        text: "Basic SFC Compiler",
        collapsed: false,
        items: [
          {
            text: "script setup に対応する",
            link: "/ja/60-basic-sfc-compiler/010-script-setup",
          },
          {
            text: "defineProps に対応する",
            link: "/ja/60-basic-sfc-compiler/020-define-props",
          },
          {
            text: "defineEmits に対応する",
            link: "/ja/60-basic-sfc-compiler/030-define-emits",
          },
          {
            text: "Scoped CSS に対応する",
            link: "/ja/60-basic-sfc-compiler/040-scoped-css",
          },
          {
            text: "Props の分割代入に対応する",
            link: "/ja/60-basic-sfc-compiler/050-props-destructure",
          },
          {
            text: "型ベースの defineProps/defineEmits",
            link: "/ja/60-basic-sfc-compiler/060-type-based-macros",
          },
        ],
      },
      {
        text: "Web Application Essentials",
        collapsed: false,
        items: [
          {
            text: "プラグイン",
            collapsed: false,
            items: [
              {
                text: "ルーター",
                link: "/ja/90-web-application-essentials/010-plugins/010-router",
              },
              {
                text: "CSS プリプロセッサ",
                link: "/ja/90-web-application-essentials/010-plugins/020-preprocessors",
              },
            ],
          },
          {
            text: "Server Side Rendering",
            collapsed: false,
            items: [
              {
                text: "renderToString",
                link: "/ja/90-web-application-essentials/020-ssr/010-create-ssr-app",
              },
              {
                text: "Hydration",
                link: "/ja/90-web-application-essentials/020-ssr/020-hydration",
              },
            ],
          },
          {
            text: "組み込みコンポーネント",
            collapsed: false,
            items: [
              {
                text: "KeepAlive",
                link: "/ja/90-web-application-essentials/030-builtins/010-keep-alive",
              },
              {
                text: "Transition",
                link: "/ja/90-web-application-essentials/030-builtins/030-transition",
              },
            ],
          },
          {
            text: "最適化",
            collapsed: false,
            items: [
              {
                text: "Static Hoisting",
                link: "/ja/90-web-application-essentials/040-optimizations/010-static-hoisting",
              },
              {
                text: "Patch Flags",
                link: "/ja/90-web-application-essentials/040-optimizations/020-patch-flags",
              },
              {
                text: "Tree Flattening",
                link: "/ja/90-web-application-essentials/040-optimizations/030-tree-flattening",
              },
            ],
          },
          {
            text: "Vapor Mode",
            collapsed: false,
            items: [
              {
                text: "Vapor Mode",
                link: "/ja/90-web-application-essentials/050-vapor/010-introduction",
              },
            ],
          },
        ],
      },
      {
        text: "付録",
        collapsed: false,
        items: [
          {
            text: "15 分で Vue を作る",
            collapsed: false,
            items: [
              {
                text: "chibivue、デカくないですか...?",
                link: "/ja/bonus/hyper-ultimate-super-extreme-minimal-vue/",
              },
              {
                text: "実装",
                link: "/ja/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl",
              },
            ],
          },
          {
            text: "本家のソースコードをデバッグする",
            link: "/ja/bonus/debug-vuejs-core",
          },
        ],
      },
    ],
  },
};
