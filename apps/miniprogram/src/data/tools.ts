/**
 * 新增小工具：在这里加一项，并在 pages.json 的 subpages 分包里登记页面（体积大的工具单独开分包，例如 subsolar）。
 * 图标在 scripts/render-tool-icons.mjs 里画，输出到 static/tools。
 */
export type ToolEntry = {
  key: string
  name: string
  image: string
  url: string
}

export const TOOLS: ToolEntry[] = [
  {
    key: 'copybook',
    name: '字帖生成',
    image: '/static/tools/copybook.png',
    url: '/subpages/copybook/index',
  },
  {
    key: 'maths',
    name: '计算题生成',
    image: '/static/tools/maths.png',
    url: '/subpages/maths/index',
  },
  {
    key: 'clock',
    name: '认识时钟',
    image: '/static/tools/clock.png',
    url: '/subpages/clock/index',
  },
  {
    key: 'solar',
    name: '3D 太阳系',
    image: '/static/tools/solar.png',
    url: '/subsolar/index',
  },
]
