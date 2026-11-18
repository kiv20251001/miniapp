// 用 pinyin-pro 生成字帖分包里的常用字读音表。小程序打包会把 node_modules 抽进主包，所以页面只引用生成结果。
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'

const lines = []
for (let code = 0x4e00; code <= 0x9fff; code += 1) {
  const char = String.fromCharCode(code)
  const listed = pinyin(char, { toneType: 'symbol', multiple: true, type: 'array' })
  const value = (Array.isArray(listed) ? listed[0] : listed).trim()
  if (!value || value === char || /[\u3400-\u9fff]/.test(value)) continue
  lines.push(char + value)
}

const target = join(dirname(fileURLToPath(import.meta.url)), '../src/subpages/copybook/readings.ts')
const source = `/** 常用汉字的默认读音。由 scripts/gen-copybook-readings.mjs 生成，不要手改。 */
const RAW = ${JSON.stringify(lines.join('\n'))}

let readings: Map<string, string> | undefined

export function readingOfChar(char: string) {
  if (!readings) {
    readings = new Map<string, string>()
    for (const line of RAW.split('\\n')) readings.set(line[0], line.slice(1))
  }
  return readings.get(char) ?? ''
}
`
writeFileSync(target, source)
console.log(`readings ${lines.length} chars, ${source.length} bytes`)
