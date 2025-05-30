import { defineConfig } from 'vitepress'

export const zhCnConfig = defineConfig({
  themeConfig: {
    nav: [
      { text: '首页', link: '/zh-cn/' },
      { text: '开始学习', link: '/zh-cn/00-introduction/010-about' },
    ],
    sidebar: [
      {
        text: '介绍',
        collapsed: false,
        items: [
          { text: '关于本书', link: '/zh-cn/00-introduction/010-about' },
          { text: '前置知识', link: '/zh-cn/00-introduction/020-prerequisite' },
          { text: 'Vue.js 核心组件', link: '/zh-cn/00-introduction/030-vue-core-components' },
          { text: '环境设置', link: '/zh-cn/00-introduction/040-setup-project' },
        ],
      },
      {
        text: '最小示例',
        collapsed: false,
        items: [
          { text: 'createApp API', link: '/zh-cn/10-minimum-example/010-create-app-api' },
          { text: '简单的 h 函数', link: '/zh-cn/10-minimum-example/020-simple-h-function' },
          { text: '简单组件', link: '/zh-cn/10-minimum-example/030-simple-component' },
          { text: 'setup 组合式 API', link: '/zh-cn/10-minimum-example/040-setup-composition-api' },
          { text: '最小响应式', link: '/zh-cn/10-minimum-example/050-minimum-reactive' },
          { text: '响应式代理处理器', link: '/zh-cn/10-minimum-example/060-reactive-proxy-handler' },
          { text: 'computed 和 ref', link: '/zh-cn/10-minimum-example/070-computed-ref' },
          { text: '补丁键控子元素', link: '/zh-cn/10-minimum-example/080-patch-keyed-children' },
          { text: '模板编译器', link: '/zh-cn/10-minimum-example/090-template-compiler' },
          { text: '最小 SFC', link: '/zh-cn/10-minimum-example/100-minimum-sfc' },
        ],
      },
      {
        text: '基础虚拟 DOM',
        collapsed: false,
        items: [
          { text: '什么是虚拟 DOM', link: '/zh-cn/20-basic-virtual-dom/010-what-is-virtual-dom' },
          { text: '简单虚拟 DOM', link: '/zh-cn/20-basic-virtual-dom/020-simple-virtual-dom' },
          { text: '补丁子元素', link: '/zh-cn/20-basic-virtual-dom/030-patch-children' },
          { text: '调度器', link: '/zh-cn/20-basic-virtual-dom/040-scheduler' },
        ],
      },
      {
        text: '基础响应式系统',
        collapsed: false,
        items: [
          { text: 'ref 和 reactive', link: '/zh-cn/30-basic-reactivity-system/010-ref-reactive' },
          { text: 'computed', link: '/zh-cn/30-basic-reactivity-system/020-computed' },
          { text: 'watch', link: '/zh-cn/30-basic-reactivity-system/030-watch' },
          { text: 'effect 作用域', link: '/zh-cn/30-basic-reactivity-system/040-effect-scope' },
          { text: '其他 API', link: '/zh-cn/30-basic-reactivity-system/050-other-apis' },
          { text: '代理处理器', link: '/zh-cn/30-basic-reactivity-system/060-proxy-handler' },
        ],
      },
      {
        text: '基础组件系统',
        collapsed: false,
        items: [
          { text: '生命周期', link: '/zh-cn/40-basic-component-system/010-lifecycle' },
          { text: 'provide/inject', link: '/zh-cn/40-basic-component-system/020-provide-inject' },
          { text: '组件代理', link: '/zh-cn/40-basic-component-system/030-component-proxy' },
          { text: '组件插槽', link: '/zh-cn/40-basic-component-system/040-component-slot' },
          { text: '组件事件', link: '/zh-cn/40-basic-component-system/050-component-emit' },
        ],
      },
      {
        text: '基础模板编译器',
        collapsed: false,
        items: [
          { text: '转换', link: '/zh-cn/50-basic-template-compiler/010-transform' },
          { text: 'v-bind', link: '/zh-cn/50-basic-template-compiler/020-v-bind' },
          { text: '转换表达式', link: '/zh-cn/50-basic-template-compiler/022-transform-expression' },
          { text: 'v-on', link: '/zh-cn/50-basic-template-compiler/025-v-on' },
          { text: '事件修饰符', link: '/zh-cn/50-basic-template-compiler/027-event-modifier' },
          { text: 'Fragment', link: '/zh-cn/50-basic-template-compiler/030-fragment' },
          { text: '注释', link: '/zh-cn/50-basic-template-compiler/035-comment' },
          { text: 'v-if 和结构指令', link: '/zh-cn/50-basic-template-compiler/040-v-if-and-structural-directive' },
          { text: 'v-for', link: '/zh-cn/50-basic-template-compiler/050-v-for' },
          { text: '解析组件', link: '/zh-cn/50-basic-template-compiler/070-resolve-component' },
          { text: '组件插槽', link: '/zh-cn/50-basic-template-compiler/080-component-slot-outlet' },
        ],
      },
      {
        text: '基础 SFC 编译器',
        collapsed: false,
        items: [
          { text: 'script setup', link: '/zh-cn/60-basic-sfc-compiler/010-script-setup' },
          { text: 'defineProps', link: '/zh-cn/60-basic-sfc-compiler/020-define-props' },
          { text: 'defineEmits', link: '/zh-cn/60-basic-sfc-compiler/030-define-emits' },
          { text: '作用域 CSS', link: '/zh-cn/60-basic-sfc-compiler/040-scoped-css' },
        ],
      },
      {
        text: 'Web 应用程序要点',
        collapsed: false,
        items: [
          {
            text: '插件',
            collapsed: false,
            items: [
              { text: '路由器', link: '/zh-cn/90-web-application-essentials/010-plugins/010-router' },
              { text: '预处理器', link: '/zh-cn/90-web-application-essentials/010-plugins/020-preprocessors' },
            ],
          },
          {
            text: 'SSR',
            collapsed: false,
            items: [
              { text: '创建 SSR 应用', link: '/zh-cn/90-web-application-essentials/020-ssr/010-create-ssr-app' },
              { text: '水合', link: '/zh-cn/90-web-application-essentials/020-ssr/020-hydration' },
            ],
          },
          {
            text: '内置组件',
            collapsed: false,
            items: [
              { text: 'KeepAlive', link: '/zh-cn/90-web-application-essentials/030-builtins/010-keep-alive' },
              { text: 'Suspense', link: '/zh-cn/90-web-application-essentials/030-builtins/020-suspense' },
              { text: 'Transition', link: '/zh-cn/90-web-application-essentials/030-builtins/030-transition' },
            ],
          },
          {
            text: '优化',
            collapsed: false,
            items: [
              { text: '静态提升', link: '/zh-cn/90-web-application-essentials/040-optimizations/010-static-hoisting' },
              { text: '补丁标志', link: '/zh-cn/90-web-application-essentials/040-optimizations/020-patch-flags' },
              { text: '树扁平化', link: '/zh-cn/90-web-application-essentials/040-optimizations/030-tree-flattening' },
            ],
          },
        ],
      },
      {
        text: '附录',
        collapsed: false,
        items: [
          { text: '调试 Vue.js 核心', link: '/zh-cn/bonus/debug-vuejs-core' },
          {
            text: 'Hyper Ultimate Super Extreme Minimal Vue',
            collapsed: false,
            items: [
              { text: '介绍', link: '/zh-cn/bonus/hyper-ultimate-super-extreme-minimal-vue/index' },
              { text: '15分钟实现', link: '/zh-cn/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl' },
            ],
          },
        ],
      },
    ],
    editLink: {
      pattern: 'https://github.com/chibivue-land/chibivue/blob/main/book/online-book/src/:path',
      text: '在 GitHub 上编辑此页面',
    },
    footer: {
      message: '基于 MIT 许可证发布。',
      copyright: 'Copyright © 2023-present ubugeeei',
    },
    docFooter: {
      prev: '上一页',
      next: '下一页',
    },
    outline: {
      label: '页面导航',
    },
    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium',
      },
    },
    langMenuLabel: '多语言',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
  },
})
