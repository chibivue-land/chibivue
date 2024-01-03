import { defineConfig } from 'vitepress'

export const sharedConfig = defineConfig({
  title: 'The chibivue Book',
  appearance: 'dark',
  description:
    'Writing Vue.js: Step by Step, from just one line of "Hello, World".',
  lang: 'ja',
  srcDir: 'src',
  srcExclude: ['__wip'],
  head: [
    [
      'link',
      {
        rel: 'icon',
        href: 'https://github.com/Ubugeeei/chibivue/blob/main/book/images/logo/logo.png?raw=true',
      },
    ],

    // og
    ['meta', { property: 'og:site_name', content: 'chibivue' }],
    [
      'meta',
      { property: 'og:url', content: 'https://ubugeeei.github.io/chibivue' },
    ],
    ['meta', { property: 'og:title', content: 'chibivue' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Writing Vue.js: Step by Step, from just one line of "Hello, World".',
      },
    ],
    [
      'meta',
      {
        property: 'og:image',
        content:
          'https://github.com/Ubugeeei/chibivue/blob/main/book/images/logo/chibivue-img.png?raw=true',
      },
    ],
    ['meta', { property: 'og:image:alt', content: 'chibivue' }],
    ['meta', { name: 'twitter:site', content: 'chibivue' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'chibivue' }],
    [
      'meta',
      {
        name: 'twitter:description',
        content:
          'Writing Vue.js: Step by Step, from just one line of "Hello, World".',
      },
    ],
    [
      'meta',
      {
        name: 'twitter:image',
        content:
          'https://github.com/Ubugeeei/chibivue/blob/main/book/images/logo/chibivue-img.png?raw=true',
      },
    ],
    ['meta', { name: 'twitter:image:alt', content: 'chibivue' }],
  ],
  themeConfig: {
    logo: 'https://github.com/Ubugeeei/chibivue/blob/main/book/images/logo/logo.png?raw=true',
    search: { provider: 'local' },
    outline: 'deep',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Ubugeeei/chibivue' },
      { icon: 'twitter', link: 'https://twitter.com/ubugeeei' },
      { icon: 'discord', link: 'https://discord.gg/aVHvmbmSRy' },
    ],
    editLink: {
      pattern:
        'https://github.com/Ubugeeei/chibivue/blob/main/book/online-book/src/:path',
      text: 'Suggest changes to this page',
    },
    footer: {
      copyright: `Copyright © 2023-${new Date().getFullYear()} ubugeeei`,
      message: 'Released under the MIT License.',
    },
  },
})
