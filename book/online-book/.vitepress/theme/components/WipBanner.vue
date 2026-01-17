<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { page, frontmatter } = useData()

const KAWAIKO_WARNING =
  'https://raw.githubusercontent.com/chibivue-land/art/main/kawaiko_warning.png'

// Check if page is WIP based on frontmatter or title containing 🚧 or "WIP"
const isWip = computed(() => {
  if (frontmatter.value.wip === true) return true
  const title = page.value.title || ''
  return title.includes('🚧') || title.includes('WIP')
})

// Get custom message from frontmatter or use default
const wipMessage = computed(() => {
  if (typeof frontmatter.value.wip === 'string') {
    return frontmatter.value.wip
  }
  return 'このページは準備中です。内容が変更される可能性があります。'
})
</script>

<template>
  <div v-if="isWip" class="wip-banner">
    <div class="wip-banner__content">
      <img
        :src="KAWAIKO_WARNING"
        alt="Kawaiko Warning"
        class="wip-banner__mascot"
        loading="eager"
      />
      <div class="wip-banner__text">
        <span class="wip-banner__label">Work in Progress</span>
        <p class="wip-banner__message">{{ wipMessage }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wip-banner {
  margin: 0 0 24px 0;
  padding: 16px 20px;
  background: linear-gradient(
    135deg,
    rgba(244, 211, 94, 0.12) 0%,
    rgba(232, 165, 69, 0.08) 100%
  );
  border: 1px solid var(--c-duck-yellow, #f4d35e);
  border-radius: 12px;
  border-left: 4px solid var(--c-duck-orange, #e8a545);
}

.wip-banner__content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.wip-banner__mascot {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  animation: wiggle 2s ease-in-out infinite;
}

@keyframes wiggle {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-5deg);
  }
  75% {
    transform: rotate(5deg);
  }
}

.wip-banner__text {
  flex: 1;
}

.wip-banner__label {
  display: inline-block;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--c-duck-orange, #e8a545);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.wip-banner__message {
  margin: 0;
  font-size: 0.95rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}

/* Dark mode */
html.dark .wip-banner {
  background: linear-gradient(
    135deg,
    rgba(244, 211, 94, 0.1) 0%,
    rgba(232, 165, 69, 0.06) 100%
  );
}

/* Responsive */
@media (max-width: 640px) {
  .wip-banner {
    padding: 12px 16px;
  }

  .wip-banner__content {
    gap: 12px;
  }

  .wip-banner__mascot {
    width: 44px;
    height: 44px;
  }

  .wip-banner__label {
    font-size: 0.8rem;
  }

  .wip-banner__message {
    font-size: 0.9rem;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wip-banner__mascot {
    animation: none;
  }
}
</style>
