import { defineConfig } from 'vitepress'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../../src/config/loader.js'
import { buildSidebar } from '../../src/vitepress/sidebar.js'

const here = fileURLToPath(new URL('.', import.meta.url))
const docsRoot = resolve(here, '..')

const { projects } = loadConfig().projects
const sidebar = {
  ...buildSidebar([{ id: 'antigravity', route: '/antigravity/' }], docsRoot),
  ...buildSidebar(
    projects.map((p) => ({ id: p.id, route: p.route })),
    docsRoot,
  ),
}

export default defineConfig({
  lang: 'zh-CN',
  title: 'Antigravity Docs 中文',
  description: 'Google Antigravity 社区中文整理 · 非官方',
  // GitHub Pages serves under /antigravity-doc-zh/ — must match the repo name exactly.
  base: '/antigravity-doc-zh/',
  cleanUrls: true,
  lastUpdated: false,
  // Dead links in translated docs are expected (upstream anchors we don't host).
  ignoreDeadLinks: true,

  head: [
    ['meta', { name: 'theme-color', content: '#3c8772' }],
    ['meta', { name: 'robots', content: 'index,follow' }],
  ],

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: 'Antigravity', link: '/antigravity/' },
      ...projects.map((p) => ({ text: p.name, link: p.route })),
      { text: '关于', link: '/about/' },
    ],

    sidebar,

    socialLinks: [{ icon: 'github', link: 'https://github.com/OrionPace/antigravity-doc-zh' }],

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
        'Antigravity 社区中文整理 · 非官方 · Not affiliated with Google or upstream projects',
      copyright: '基础设施代码 MIT 许可证；整理/翻译内容遵循对应官方来源许可与合理引用边界',
    },
  },
})
