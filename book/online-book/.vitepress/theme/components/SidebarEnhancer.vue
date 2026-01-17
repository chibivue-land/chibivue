<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()

const KAWAIKO_WARNING =
  'https://raw.githubusercontent.com/chibivue-land/art/main/kawaiko_warning.png'
const KAWAIKO_SURPRISE =
  'https://raw.githubusercontent.com/chibivue-land/art/main/kawaiko_surprise.png'

// Chapters that are outdated and need surprise warning
const outdatedChapters = ['template-compiler', 'reactivity-system']

function enhanceSidebar() {
  // Replace 🚧 with kawaiko_warning image at the end
  const sidebarItems = document.querySelectorAll('.VPSidebar .text')

  sidebarItems.forEach(item => {
    const text = item.textContent || ''

    // Move 🚧 emoji to the end as an image
    if (text.includes('🚧') && !item.querySelector('.kawaiko-sidebar-icon')) {
      // Remove the 🚧 emoji from text
      item.innerHTML = item.innerHTML.replace('🚧', '').trim()

      // Append image at the end
      const img = document.createElement('img')
      img.src = KAWAIKO_WARNING
      img.alt = 'WIP'
      img.className = 'kawaiko-sidebar-icon'
      img.style.cssText =
        'width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-left: 6px;'

      item.appendChild(img)
    }
  })

  // Add subtle outdated indicator to section headers (text-based, not image)
  const sectionHeaders = document.querySelectorAll(
    '.VPSidebar .VPSidebarItem.level-0 > .item',
  )

  sectionHeaders.forEach(header => {
    const textEl = header.querySelector('.text')
    if (!textEl) return

    const text = textEl.textContent || ''
    const isOutdated = outdatedChapters.some(
      chapter =>
        text.toLowerCase().includes(chapter.toLowerCase()) &&
        !text.includes('🚧'),
    )

    if (isOutdated && !header.classList.contains('outdated-section')) {
      header.classList.add('outdated-section')
    }
  })
}

onMounted(() => {
  // Initial enhancement
  setTimeout(enhanceSidebar, 100)

  // Re-enhance on route change
  watch(
    () => route.path,
    () => {
      setTimeout(enhanceSidebar, 100)
    },
  )

  // Also observe DOM changes for dynamic sidebar updates
  const observer = new MutationObserver(() => {
    enhanceSidebar()
  })

  const sidebar = document.querySelector('.VPSidebar')
  if (sidebar) {
    observer.observe(sidebar, { childList: true, subtree: true })
  }
})
</script>

<template>
  <div class="sidebar-enhancer"></div>
</template>

<style>
.kawaiko-sidebar-icon {
  transition: transform 0.2s ease;
}

.kawaiko-sidebar-icon:hover {
  transform: scale(1.2);
}

/* Outdated section styling */
.outdated-section .text::after {
  content: ' (outdated)';
  font-size: 0.75em;
  color: var(--c-duck-orange, #e8a545);
  font-weight: 400;
  opacity: 0.8;
}
</style>
