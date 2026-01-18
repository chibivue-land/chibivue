<script setup lang="ts">
import { useData } from 'vitepress'
import HeroSection from './HeroSection.vue'
import FeaturesSection from './FeaturesSection.vue'

const { lang } = useData()

const heroContent: Record<
  string,
  {
    tagline: string
    startButton: string
    vueButton: string
  }
> = {
  en: {
    tagline:
      "Writing Vue.js: Step by Step, from just one line of 'Hello, World'.",
    startButton: 'Start Learning',
    vueButton: 'Vue.js Official',
  },
  ja: {
    tagline:
      "Writing Vue.js: Step by Step, from just one line of 'Hello, World'.",
    startButton: 'Start Learning',
    vueButton: 'Vue.js Official',
  },
  'zh-cn': {
    tagline: "编写 Vue.js：从一行 'Hello, World' 开始，循序渐进。",
    startButton: '开始学习',
    vueButton: 'Vue.js 官方',
  },
  'zh-tw': {
    tagline: "編寫 Vue.js：從一行 'Hello, World' 開始，循序漸進。",
    startButton: '開始學習',
    vueButton: 'Vue.js 官方',
  },
}

const featuresContent: Record<
  string,
  Array<{
    icon: string
    title: string
    description: string
  }>
> = {
  en: [
    {
      icon: 'reactivity',
      title: 'Reactivity System',
      description:
        'From the basic principles of the Reactivity System, we will cover a wide range of implementations, from EffectScope to advanced APIs like CustomRef.',
    },
    {
      icon: 'vdom',
      title: 'Virtual DOM',
      description:
        'We will cover a broad range of implementations, from the basic setup of the Virtual DOM to patch rendering and scheduler implementations.',
    },
    {
      icon: 'compiler',
      title: 'Template Compiler',
      description:
        'From the fundamental implementation of the template compiler, we will extend our coverage to data binding and directive implementations.',
    },
    {
      icon: 'sfc',
      title: 'Single File Component',
      description:
        'Starting from the basic implementation of SFCs, we will delve into a wide range of areas, from script setup to compiler macros and scoped CSS implementations.',
    },
  ],
  ja: [
    {
      icon: 'reactivity',
      title: 'Reactivity System',
      description:
        'Reactivity System の基本原理から、EffectScope や CustomRef などの高度な API の実装まで、幅広くカバーします。',
    },
    {
      icon: 'vdom',
      title: 'Virtual DOM',
      description:
        'Virtual DOM の基本的なセットアップから、パッチレンダリングやスケジューラの実装まで、幅広くカバーします。',
    },
    {
      icon: 'compiler',
      title: 'Template Compiler',
      description:
        'テンプレートコンパイラの基本的な実装から、データバインディングやディレクティブの実装まで拡張します。',
    },
    {
      icon: 'sfc',
      title: 'Single File Component',
      description:
        'SFC の基本的な実装から、script setup やコンパイラマクロ、scoped CSS の実装まで、幅広く掘り下げます。',
    },
  ],
  'zh-cn': [
    {
      icon: 'reactivity',
      title: 'Reactivity System',
      description:
        '从响应式系统的基本原理到 EffectScope 和 CustomRef 等高级 API 的实现。',
    },
    {
      icon: 'vdom',
      title: 'Virtual DOM',
      description: '从虚拟 DOM 的基本设置到 patch 渲染和调度器的实现。',
    },
    {
      icon: 'compiler',
      title: 'Template Compiler',
      description: '从模板编译器的基本实现到数据绑定和指令的实现。',
    },
    {
      icon: 'sfc',
      title: 'Single File Component',
      description:
        '从 SFC 的基本实现到 script setup、编译器宏和 scoped CSS 的实现。',
    },
  ],
  'zh-tw': [
    {
      icon: 'reactivity',
      title: 'Reactivity System',
      description:
        '從響應式系統的基本原理到 EffectScope 和 CustomRef 等高級 API 的實現。',
    },
    {
      icon: 'vdom',
      title: 'Virtual DOM',
      description: '從虛擬 DOM 的基本設置到 patch 渲染和調度器的實現。',
    },
    {
      icon: 'compiler',
      title: 'Template Compiler',
      description: '從模板編譯器的基本實現到數據綁定和指令的實現。',
    },
    {
      icon: 'sfc',
      title: 'Single File Component',
      description:
        '從 SFC 的基本實現到 script setup、編譯器宏和 scoped CSS 的實現。',
    },
  ],
}

const currentHero = heroContent[lang.value] || heroContent.en
const currentFeatures = featuresContent[lang.value] || featuresContent.en

const startLink =
  lang.value === 'en'
    ? '/00-introduction/010-about'
    : `/${lang.value}/00-introduction/010-about`
</script>

<template>
  <div class="custom-home">
    <HeroSection :content="currentHero" :start-link="startLink" />
    <FeaturesSection :features="currentFeatures" />
  </div>
</template>

<style scoped>
.custom-home {
  width: 100%;
}
</style>
