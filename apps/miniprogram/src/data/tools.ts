/** 新增小工具：在这里加一项，并在 pages.json 的 subpages 分包里登记页面。 */
export type ToolEntry = {
  key: string
  name: string
  icon: string
  colors: [string, string]
  url: string
}

export const TOOLS: ToolEntry[] = [
  {
    key: 'copybook',
    name: '字帖生成',
    icon: 'calligraphy',
    colors: ['#7ddec4', '#1aa286'],
    url: '/subpages/copybook/index',
  },
]
