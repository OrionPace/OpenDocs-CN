import { defineConfig } from 'vitepress'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../../src/config/loader.js'
import { buildSidebar } from '../../src/vitepress/sidebar.js'
import { STANDARD_HTML5_ELEMENTS } from '../../src/translation/file-qa.js'

const here = fileURLToPath(new URL('.', import.meta.url))
const docsRoot = resolve(here, '..')

const { projects } = loadConfig().projects
const sidebar = buildSidebar(
  projects.map((p) => ({ id: p.id, route: p.route })),
  docsRoot,
)

export default defineConfig({
  vue: {
    template: {
      compilerOptions: {
        // CLI docs often contain angle-bracket placeholders like <extension-names>
        // or <crate> in plain text. Tell Vue to treat non-standard tags as custom
        // web components (lenient about closing) while still validating standard
        // HTML5 elements (details, div, etc.) normally.
        isCustomElement: (tag) => !STANDARD_HTML5_ELEMENTS.has(tag.toLowerCase()),
      },
    },
  },

  lang: 'zh-CN',
  title: 'OpenDocs CN',
  description: '社区中文翻译 · 非官方 · Unofficial community translation',
  // GitHub Pages serves under /OpenDocs-CN/ — must match the repo name exactly.
  base: '/OpenDocs-CN/',
  cleanUrls: true,
  lastUpdated: false,

  head: [
    ['meta', { name: 'theme-color', content: '#3c8772' }],
    ['meta', { name: 'robots', content: 'index,follow' }],
  ],

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      ...projects.map((p) => ({ text: p.name, link: p.route })),
      { text: '关于', link: '/about/' },
    ],

    sidebar,

    socialLinks: [{ icon: 'github', link: 'https://github.com/opendocs-cn/opendocs-cn' }],

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
              modal: {
                noResultsText: '无相关结果',
                resetButtonTitle: '清除查询条件',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭',
                },
              },
            },
          },
        },
      },
    },

    docFooter: { prev: '上一页', next: '下一页' },
    outline: { label: '本页目录', level: [2, 3] },
    darkModeSwitchLabel: '主题',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    langMenuLabel: '语言',

    footer: {
      message:
        '社区中文翻译 · 非官方 · Unofficial community translation · Not affiliated with the upstream projects',
      copyright: '内容遵循各项目原始许可证（Apache 2.0），本站基础设施代码 MIT 许可证',
    },
  },
})
