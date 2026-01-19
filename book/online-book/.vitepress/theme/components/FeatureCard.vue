<script setup lang="ts">
import MdiFlash from '~icons/mdi/flash'
import MdiFileTree from '~icons/mdi/file-tree'
import MdiCog from '~icons/mdi/cog'
import MdiPackageVariant from '~icons/mdi/package-variant'
import MdiStar from '~icons/mdi/star'
import { markRaw, type Component } from 'vue'

defineProps<{
  icon: string
  title: string
  description: string
}>()

const iconMap: Record<string, Component> = {
  reactivity: markRaw(MdiFlash),
  vdom: markRaw(MdiFileTree),
  compiler: markRaw(MdiCog),
  sfc: markRaw(MdiPackageVariant),
}

const defaultIcon = markRaw(MdiStar)
</script>

<template>
  <article class="feature-card">
    <div class="feature-icon">
      <span class="icon-glow"></span>
      <component :is="iconMap[icon] || defaultIcon" class="icon-content" />
    </div>
    <h3 class="feature-title">{{ title }}</h3>
    <p class="feature-description">{{ description }}</p>
    <div class="feature-hover-effect"></div>
  </article>
</template>

<style scoped>
.feature-card {
  position: relative;
  padding: 1.75rem;
  background: linear-gradient(
    145deg,
    rgba(26, 39, 68, 0.6) 0%,
    rgba(15, 26, 46, 0.8) 100%
  );
  border: 1px solid rgba(26, 179, 148, 0.15);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}


.feature-card:hover {
  transform: translateY(-4px);
  border-color: rgba(26, 179, 148, 0.4);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 30px rgba(26, 179, 148, 0.1);
}


.feature-icon {
  position: relative;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.icon-glow {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    var(--c-mint-400, #2cc9a8) 0%,
    var(--c-mint-500, #1ab394) 100%
  );
  border-radius: 12px;
  opacity: 0.2;
  filter: blur(8px);
  transition: opacity 0.3s;
}

.feature-card:hover .icon-glow {
  opacity: 0.4;
}

.icon-content {
  position: relative;
  font-size: 1.75rem;
  z-index: 1;
}

.feature-title {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin: 0 0 0.75rem 0;
}

.feature-description {
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  line-height: 1.7;
  margin: 0;
}

.feature-hover-effect {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(
    90deg,
    var(--c-mint-500, #1ab394) 0%,
    var(--c-mint-400, #2cc9a8) 50%,
    #5dddc2 100%
  );
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.4s ease;
}

.feature-card:hover .feature-hover-effect {
  transform: scaleX(1);
}
</style>

<style>
/* Light mode overrides - unscoped */
html:not(.dark) .feature-card {
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(248, 252, 250, 0.98) 100%
  ) !important;
  border-color: rgba(26, 179, 148, 0.25) !important;
  box-shadow: 0 4px 16px rgba(26, 179, 148, 0.08);
}

html:not(.dark) .feature-card:hover {
  box-shadow: 0 12px 32px rgba(26, 179, 148, 0.15), 0 0 24px rgba(26, 179, 148, 0.08) !important;
  border-color: rgba(26, 179, 148, 0.4) !important;
}

html:not(.dark) .feature-title {
  color: #1a2744 !important;
}

html:not(.dark) .feature-description {
  color: #3d4f5f !important;
}
</style>
