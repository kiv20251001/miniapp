/**
 * 新增小工具：在这里加一项，并在 pages.json 的 subpages 分包里登记页面（用到 three.js 的 3D 工具放 subsolar 分包，例如 3D 太阳系、3D 几何体、3D 人体器官）。
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
    key: 'pizza',
    name: '认识分数',
    image: '/static/tools/pizza.png',
    url: '/subpages/pizza/index',
  },
  {
    key: 'solar',
    name: '3D 太阳系',
    image: '/static/tools/solar.png',
    url: '/subsolar/index',
  },
  {
    key: 'cube',
    name: '3D 几何体',
    image: '/static/tools/cube.png',
    url: '/subsolar/cube/index',
  },
  {
    key: 'units',
    name: '单位换算',
    image: '/static/tools/units.png',
    url: '/subpages/units/index',
  },
  {
    key: 'body',
    name: '3D 人体器官',
    image: '/static/tools/body.png',
    url: '/subsolar/body/index',
  },
]
