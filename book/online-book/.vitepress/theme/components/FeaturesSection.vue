<script setup lang="ts">
import FeatureCard from './FeatureCard.vue'

defineProps<{
  features: Array<{
    icon: string
    title: string
    description: string
  }>
}>()
</script>

<template>
  <section class="features-section">
    <div class="features-container">
      <div class="features-grid">
        <FeatureCard
          v-for="(feature, index) in features"
          :key="index"
          :icon="feature.icon"
          :title="feature.title"
          :description="feature.description"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.features-section {
  padding: 4rem 2rem 6rem;
  background: var(--features-bg, #0f1724);
}

.features-container {
  max-width: 1200px;
  margin: 0 auto;
}

.features-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 640px) {
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
  }
}

@media (min-width: 960px) {
  .features-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>

<style>
/* Light mode override - unscoped */
html:not(.dark) .features-section {
  background: linear-gradient(180deg, #f0f5f3 0%, #e8f0ed 100%) !important;
}
</style>
