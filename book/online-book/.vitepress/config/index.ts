import { sharedConfig } from './shared.js'
import { jaConfig } from './ja'
import { enConfig } from './en.js'
import { zhCnConfig } from './zh-cn.js'
import { zhTwConfig } from './zh-tw.js'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { defineConfig } from 'vitepress'

// The same situation as the issue below is occurring, so mermaid is rendered only during production build.
// https://github.com/iamkun/dayjs/issues/480
export default (process.env.NODE_ENV === 'production'
  ? withMermaid
  : defineConfig)({
  ...sharedConfig,
  locales: {
    root: { label: 'English', lang: 'en', link: '/', ...enConfig },
    ja: { label: '日本語', lang: 'ja', link: '/ja', ...jaConfig },
    'zh-cn': { label: '简体中文', lang: 'zh-CN', link: '/zh-cn', ...zhCnConfig },
    'zh-tw': { label: '繁體中文', lang: 'zh-TW', link: '/zh-tw', ...zhTwConfig },
  },
})
