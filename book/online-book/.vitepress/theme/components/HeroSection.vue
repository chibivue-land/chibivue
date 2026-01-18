<script setup lang="ts">
declare const __CHIBIVUE_VERSION__: string

defineProps<{
  content: {
    tagline: string
    startButton: string
    vueButton: string
  }
  startLink: string
}>()

const version = __CHIBIVUE_VERSION__
</script>

<template>
  <section class="hero-section">
    <div class="hero-background">
      <div class="code-pattern"></div>
      <div class="gradient-overlay"></div>
    </div>

    <div class="hero-content">
      <div class="hero-text">
        <h1 class="hero-title">
          <span class="gradient-text">chibivue</span>
          <span class="version-badge">v{{ version }}</span>
        </h1>
        <p class="hero-tagline">{{ content.tagline }}</p>

        <div class="hero-actions">
          <a :href="startLink" class="btn-primary">
            {{ content.startButton }}
            <span class="arrow">-></span>
          </a>
          <a
            href="https://v3.vuejs.org/"
            class="btn-secondary"
            target="_blank"
            rel="noopener"
          >
            {{ content.vueButton }}
          </a>
        </div>
      </div>

      <div class="hero-visual">
        <div class="stairs-container">
          <div class="stair stair-1"></div>
          <div class="stair stair-2"></div>
          <div class="stair stair-3"></div>
          <div class="stair stair-4"></div>
          <div class="stair stair-5"></div>

          <div class="mascot-container">
            <img
              src="https://raw.githubusercontent.com/chibivue-land/art/main/kawaiko.png"
              alt="Kawaiko - chibivue mascot"
              class="mascot"
              loading="eager"
            />
          </div>
        </div>

        <div class="code-snippets">
          <div class="snippet snippet-1">
            <code>const app = createApp()</code>
          </div>
          <div class="snippet snippet-2">
            <code>ref() reactive()</code>
          </div>
          <div class="snippet snippet-3">
            <code>&lt;template&gt;</code>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero-section {
  position: relative;
  min-height: 80vh;
  display: flex;
  align-items: center;
  overflow: hidden;
  padding: 4rem 2rem;
}

.hero-background {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.code-pattern {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
      circle at 20% 50%,
      rgba(26, 179, 148, 0.1) 0%,
      transparent 50%
    ),
    radial-gradient(
      circle at 80% 20%,
      rgba(44, 201, 168, 0.08) 0%,
      transparent 40%
    );
  opacity: 0.6;
}

.gradient-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #0f1724 0%, #0d121b 100%);
  opacity: 0.95;
}

.hero-content {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr;
  gap: 3rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

@media (min-width: 960px) {
  .hero-content {
    grid-template-columns: 1fr 1fr;
    gap: 4rem;
  }
}

.hero-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}

@media (min-width: 960px) {
  .hero-text {
    text-align: left;
  }
}

.hero-title {
  margin: 0;
  line-height: 1.1;
}

.gradient-text {
  background: linear-gradient(
    135deg,
    var(--c-mint-500, #1ab394) 0%,
    var(--c-mint-400, #2cc9a8) 50%,
    #5dddc2 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: clamp(3rem, 10vw, 5rem);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.version-badge {
  display: inline-block;
  vertical-align: super;
  font-size: clamp(0.75rem, 2vw, 1rem);
  font-weight: 600;
  padding: 0.25em 0.6em;
  margin-left: 0.5rem;
  background: rgba(26, 179, 148, 0.15);
  border: 1px solid rgba(26, 179, 148, 0.4);
  border-radius: 6px;
  color: var(--c-mint-400, #2cc9a8);
}

.hero-tagline {
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  color: var(--vp-c-text-2);
  margin: 1.5rem 0 2rem;
  line-height: 1.7;
  max-width: 500px;
}

@media (min-width: 960px) {
  .hero-tagline {
    margin: 1.5rem 0 2.5rem;
  }
}

@media (max-width: 959px) {
  .hero-tagline {
    margin-left: auto;
    margin-right: auto;
  }
}

.hero-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

@media (min-width: 960px) {
  .hero-actions {
    justify-content: flex-start;
  }
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.75rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  transition: all 0.25s ease;
}

.btn-primary {
  background: var(--c-mint-500, #1ab394);
  color: #ffffff;
  border: 2px solid transparent;
}

.btn-primary:hover {
  background: var(--c-mint-600, #159d82);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(26, 179, 148, 0.3);
}

.btn-primary .arrow {
  transition: transform 0.2s ease;
}

.btn-primary:hover .arrow {
  transform: translateX(4px);
}

.btn-secondary {
  background: transparent;
  color: var(--vp-c-text-1);
  border: 2px solid var(--vp-c-border);
}

.btn-secondary:hover {
  border-color: var(--c-mint-400, #2cc9a8);
  color: var(--c-mint-500, #1ab394);
}

/* Hero Visual - Stairs */
.hero-visual {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  order: -1;
}

@media (min-width: 960px) {
  .hero-visual {
    order: 0;
  }
}

.stairs-container {
  position: relative;
  width: 100%;
  max-width: 350px;
  height: 300px;
}

@media (min-width: 640px) {
  .stairs-container {
    max-width: 400px;
    height: 350px;
  }
}

.stair {
  position: absolute;
  width: 100px;
  height: 24px;
  background: linear-gradient(
    180deg,
    var(--c-mint-400, #2cc9a8) 0%,
    var(--c-mint-500, #1ab394) 100%
  );
  border-radius: 4px;
  box-shadow:
    0 4px 20px rgba(26, 179, 148, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  animation: stairAppear 0.6s ease-out forwards;
  opacity: 0;
}

@media (min-width: 640px) {
  .stair {
    width: 120px;
    height: 30px;
  }
}

.stair-1 {
  bottom: 20px;
  left: 10%;
  animation-delay: 0.1s;
}
.stair-2 {
  bottom: 60px;
  left: 20%;
  animation-delay: 0.2s;
}
.stair-3 {
  bottom: 100px;
  left: 30%;
  animation-delay: 0.3s;
}
.stair-4 {
  bottom: 140px;
  left: 40%;
  animation-delay: 0.4s;
}
.stair-5 {
  bottom: 180px;
  left: 50%;
  animation-delay: 0.5s;
}

@media (min-width: 640px) {
  .stair-1 {
    bottom: 20px;
    left: 0;
  }
  .stair-2 {
    bottom: 70px;
    left: 40px;
  }
  .stair-3 {
    bottom: 120px;
    left: 80px;
  }
  .stair-4 {
    bottom: 170px;
    left: 120px;
  }
  .stair-5 {
    bottom: 220px;
    left: 160px;
  }
}

@keyframes stairAppear {
  0% {
    opacity: 0;
    transform: translateY(20px) rotateX(-20deg);
  }
  100% {
    opacity: 1;
    transform: translateY(0) rotateX(0);
  }
}

/* Mascot */
.mascot-container {
  position: absolute;
  bottom: 190px;
  left: calc(50% + 20px);
  animation: mascotBounce 2s ease-in-out infinite;
  animation-delay: 0.6s;
}

@media (min-width: 640px) {
  .mascot-container {
    bottom: 230px;
    left: 140px;
  }
}

.mascot {
  width: 80px;
  height: auto;
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.3));
  transition: transform 0.3s ease;
}

@media (min-width: 640px) {
  .mascot {
    width: 100px;
  }
}

.mascot:hover {
  transform: scale(1.05) rotate(-5deg);
}

@keyframes mascotBounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

/* Code Snippets */
.code-snippets {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.snippet {
  position: absolute;
  padding: 0.5rem 1rem;
  background: rgba(26, 39, 68, 0.8);
  border: 1px solid rgba(26, 179, 148, 0.3);
  border-radius: 6px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.75rem;
  color: var(--c-mint-400, #2cc9a8);
  animation: float 4s ease-in-out infinite;
  backdrop-filter: blur(4px);
  white-space: nowrap;
}

@media (min-width: 640px) {
  .snippet {
    font-size: 0.85rem;
  }
}

.snippet-1 {
  top: 5%;
  right: 0;
  animation-delay: 0s;
}
.snippet-2 {
  top: 35%;
  right: -5%;
  animation-delay: 1.3s;
}
.snippet-3 {
  bottom: 25%;
  right: 5%;
  animation-delay: 2.6s;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-10px) rotate(1deg);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .stair {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .mascot-container {
    animation: none;
  }

  .snippet {
    animation: none;
  }
}
</style>

<style>
/* Light mode overrides - unscoped for proper cascade */
html:not(.dark) .hero-section .gradient-overlay {
  background: linear-gradient(135deg, #f8faf9 0%, #edf4f2 100%) !important;
  opacity: 1 !important;
}

html:not(.dark) .hero-section .code-pattern {
  background-image: radial-gradient(
      circle at 20% 50%,
      rgba(26, 179, 148, 0.12) 0%,
      transparent 50%
    ),
    radial-gradient(
      circle at 80% 20%,
      rgba(44, 201, 168, 0.1) 0%,
      transparent 40%
    ) !important;
}

html:not(.dark) .hero-section .hero-tagline {
  color: #3d4f5f !important;
}

html:not(.dark) .hero-section .btn-secondary {
  background: #ffffff !important;
  border-color: var(--c-mint-400, #2cc9a8) !important;
  color: #1a2744 !important;
}

html:not(.dark) .hero-section .btn-secondary:hover {
  background: #e8f7f4 !important;
  color: #1a2744 !important;
}

html:not(.dark) .hero-section .snippet {
  background: rgba(255, 255, 255, 0.95) !important;
  border-color: rgba(26, 179, 148, 0.35) !important;
  box-shadow: 0 4px 16px rgba(26, 179, 148, 0.12) !important;
  color: #1ab394 !important;
}

html:not(.dark) .hero-section .version-badge {
  background: rgba(26, 179, 148, 0.1) !important;
  border-color: rgba(26, 179, 148, 0.5) !important;
  color: #1ab394 !important;
}
</style>
