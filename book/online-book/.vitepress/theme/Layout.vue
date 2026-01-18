<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import CustomHome from './components/CustomHome.vue'
import SidebarEnhancer from './components/SidebarEnhancer.vue'
import WipBanner from './components/WipBanner.vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()
</script>

<template>
  <Layout>
    <template #home-hero-before>
      <CustomHome v-if="frontmatter.layout === 'home'" />
    </template>
    <template #doc-before>
      <WipBanner />
    </template>
    <template #layout-bottom>
      <SidebarEnhancer />
    </template>
  </Layout>
</template>

<style>
/* Hide default VitePress home elements when custom home is shown */
.VPHome .VPHero,
.VPHome .VPFeatures {
  display: none !important;
}
</style>
