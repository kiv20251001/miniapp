// 列出小程序里还没有英文的中文文案：node scripts/i18n-keys.mjs
// 扫 src 下的字符串字面量（含模板里的 t('…')），用 i18n 的 translate 跑一遍，仍含中文的就是漏翻。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = join(root, 'src')
const CJK = /[\u3400-\u9fff]/
const SKIP = [/^i18n\//, /^domain\/remind\.ts$/, /^env\.d\.ts$/, /\.spec\.ts$/]
/** 云端和共享规则返回给页面的文案也要能翻。 */
const SHARED = [
  join(root, '../../server/src/domain'),
  join(root, '../../server/src/workspace/family-actions.ts'),
  join(root, 'cloudfunctions/api/src'),
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(vue|ts)$/.test(name)) out.push(path)
  }
  return out
}

function stripComments(code) {
  return code
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

function literals(code) {
  const found = []
  const pattern = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g
  for (const match of code.matchAll(pattern)) {
    const text = match[1] ?? match[2] ?? match[3] ?? ''
    if (match[2] !== undefined && text.includes("'")) {
      found.push(...literals(text))
      continue
    }
    if (CJK.test(text) && !text.includes('${')) found.push(text)
  }
  return found
}

async function loadTranslate() {
  const result = await build({
    entryPoints: [join(src, 'i18n/en.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  })
  const url = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
  const { EN, EN_PATTERNS } = await import(url)
  const translate = (text) => {
    if (!CJK.test(text)) return text
    if (EN[text] !== undefined) return EN[text]
    for (const [pattern, render] of EN_PATTERNS) {
      const match = text.match(pattern)
      if (match) return render(match, translate)
    }
    if (text.includes(' · ')) return text.split(' · ').map(translate).join(' · ')
    return text
  }
  return { EN, translate }
}

const { EN, translate } = await loadTranslate()
const extra = process.argv.slice(2)
const missing = new Map()
const files = [
  ...walk(src),
  ...SHARED.flatMap((path) => (statSync(path).isDirectory() ? walk(path) : [path])),
]
for (const file of files) {
  const rel = relative(src, file)
  if (SKIP.some((rule) => rule.test(rel))) continue
  for (const text of literals(stripComments(readFileSync(file, 'utf8')))) {
    if (text in EN) continue
    if (CJK.test(translate(text))) missing.set(text, rel)
  }
}
for (const text of extra) {
  if (CJK.test(translate(text))) missing.set(text, 'argv')
}
for (const [text, file] of missing) console.log(`${file}\t${text}`)
console.log(`\n${missing.size} missing`)
process.exit(missing.size ? 1 : 0)
