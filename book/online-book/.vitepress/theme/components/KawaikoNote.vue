<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'base' | 'angry' | 'fanny' | 'question' | 'surprise' | 'warning'
  type?: 'info' | 'tip' | 'warning' | 'danger' | 'success'
  title?: string
  position?: 'left' | 'right'
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'base',
  type: 'info',
  position: 'left',
  size: 'md',
})

const mascotImages: Record<string, string> = {
  base: 'https://raw.githubusercontent.com/chibivue-land/art/main/kawaiko.png',
  angry:
    'https://raw.githubusercontent.com/chibivue-land/art/main/kawaiko_angry.png',
  fanny:
    'https://raw.githubusercontent.com/chibivue-land/art/main/kawaiko_fanny.png',
  question:
    'https://raw.githubusercontent.com/chibivue-land/art/main/kawaiko_question.png',
  surprise:
    'https://raw.githubusercontent.com/chibivue-land/art/main/kawaiko_surprise.png',
  warning:
    'https://raw.githubusercontent.com/chibivue-land/art/main/kawaiko_warning.png',
}

const typeToVariantMap: Record<string, string> = {
  warning: 'warning',
  danger: 'angry',
  tip: 'fanny',
  success: 'base',
  info: 'question',
}

const effectiveVariant = computed(() => {
  if (props.variant !== 'base') return props.variant
  return typeToVariantMap[props.type] || 'base'
})

const mascotSrc = computed(() => mascotImages[effectiveVariant.value])
</script>

<template>
  <div
    class="kawaiko-note"
    :class="[
      `kawaiko-note--${size}`,
      `kawaiko-note--${type}`,
      `kawaiko-note--${position}`,
    ]"
  >
    <div class="kawaiko-note__mascot">
      <img
        :src="mascotSrc"
        :alt="`Kawaiko mascot - ${effectiveVariant}`"
        class="kawaiko-note__image"
        loading="lazy"
      />
    </div>
    <div class="kawaiko-note__content">
      <div v-if="title" class="kawaiko-note__title">
        {{ title }}
      </div>
      <div class="kawaiko-note__body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.kawaiko-note {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
  margin: 16px 0;
  border-radius: 12px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
  transition: all 0.25s ease;
}

.kawaiko-note:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

html.dark .kawaiko-note:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* Positions */
.kawaiko-note--right {
  flex-direction: row-reverse;
}

/* Mascot Image */
.kawaiko-note__mascot {
  flex-shrink: 0;
}

.kawaiko-note__image {
  display: block;
  border-radius: 8px;
  object-fit: contain;
}

/* Sizes */
.kawaiko-note--sm .kawaiko-note__image {
  width: 48px;
  height: 48px;
}

.kawaiko-note--md .kawaiko-note__image {
  width: 72px;
  height: 72px;
}

.kawaiko-note--lg .kawaiko-note__image {
  width: 96px;
  height: 96px;
}

/* Content */
.kawaiko-note__content {
  flex: 1;
  min-width: 0;
}

.kawaiko-note__title {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 8px;
  color: var(--vp-c-text-1);
}

.kawaiko-note__body {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.kawaiko-note__body :deep(p) {
  margin: 0;
}

.kawaiko-note__body :deep(p + p) {
  margin-top: 8px;
}

.kawaiko-note__body :deep(code) {
  background: var(--vp-c-bg-mute);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

/* Type Variants */
.kawaiko-note--info {
  border-color: var(--c-mint-300);
  background: rgba(26, 179, 148, 0.06);
}

.kawaiko-note--tip {
  border-color: var(--c-mint-400);
  background: rgba(44, 201, 168, 0.08);
}

.kawaiko-note--success {
  border-color: var(--c-mint-500);
  background: rgba(26, 179, 148, 0.1);
}

.kawaiko-note--warning {
  border-color: var(--c-duck-yellow);
  background: rgba(244, 211, 94, 0.1);
}

.kawaiko-note--danger {
  border-color: #e85d75;
  background: rgba(232, 93, 117, 0.08);
}

/* Dark mode adjustments */
:global(html.dark) .kawaiko-note--info {
  background: rgba(26, 179, 148, 0.08);
}

:global(html.dark) .kawaiko-note--tip {
  background: rgba(44, 201, 168, 0.1);
}

:global(html.dark) .kawaiko-note--success {
  background: rgba(26, 179, 148, 0.12);
}

:global(html.dark) .kawaiko-note--warning {
  background: rgba(244, 211, 94, 0.12);
}

:global(html.dark) .kawaiko-note--danger {
  background: rgba(232, 93, 117, 0.1);
}

/* Responsive */
@media (max-width: 640px) {
  .kawaiko-note {
    padding: 12px 16px;
    gap: 12px;
  }

  .kawaiko-note--md .kawaiko-note__image,
  .kawaiko-note--lg .kawaiko-note__image {
    width: 56px;
    height: 56px;
  }
}
</style>
