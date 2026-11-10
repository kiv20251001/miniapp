// 编译前按环境改写 project.config.json：miniprogramRoot 指向本次输出目录，appid 用 .env 里的 WX_APPID。
// 用法：node scripts/use-env.mjs <development|production> <dev|build>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2] === 'production' ? 'production' : 'development'
const out = process.argv[3] === 'build' ? 'build' : 'dev'

function readEnv(file) {
  const values = {}
  if (!fs.existsSync(file)) return values
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
  return values
}

// 与 Vite 的读取顺序一致，后面的覆盖前面的。
const env = Object.assign(
  {},
  ...['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`].map((name) => readEnv(path.join(root, name))),
)
const envFile = path.join(root, '.env')
if (!fs.existsSync(envFile)) console.warn('[env] 没有找到 apps/miniprogram/.env，按空配置继续')

function updateJson(file, change) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  change(json)
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`)
}

const appid = env.WX_APPID || ''
const miniprogramRoot = `dist/${out}/mp-weixin/`

// 清掉上次的输出，避免已删除或已移到分包的旧页面、旧图片还留在包里。
fs.rmSync(path.join(root, miniprogramRoot), { recursive: true, force: true })

updateJson(path.join(root, 'project.config.json'), (json) => {
  json.miniprogramRoot = miniprogramRoot
  if (appid) json.appid = appid
})

updateJson(path.join(root, 'src/manifest.json'), (json) => {
  json['mp-weixin'] = json['mp-weixin'] || {}
  if (appid) json['mp-weixin'].appid = appid
})

const cloud = env.VITE_CLOUD_ENV
  ? `全部版本强制=${env.VITE_CLOUD_ENV}`
  : `开发版/体验版=${env.VITE_CLOUD_ENV_DEV || '(未填)'} · 正式版=${env.VITE_CLOUD_ENV_PROD || '(未填)'}`
console.log(`[env] ${mode} · miniprogramRoot=${miniprogramRoot} · appid=${appid || '(未填，沿用原值)'} · ${cloud}`)
if (!appid) console.warn(`[env] ${path.basename(envFile)} 没有填写 WX_APPID，真机预览和上传需要自己的 AppID。`)
if (!env.VITE_CLOUD_ENV && (!env.VITE_CLOUD_ENV_DEV || !env.VITE_CLOUD_ENV_PROD)) {
  console.warn(`[env] ${path.basename(envFile)} 缺少 VITE_CLOUD_ENV_DEV 或 VITE_CLOUD_ENV_PROD，缺的那一档会连到默认云环境。`)
}
if (env.VITE_CLOUD_ENV) {
  console.warn(`[env] VITE_CLOUD_ENV=${env.VITE_CLOUD_ENV} 会让体验版和正式版连同一个环境，上传正式版前请删掉。`)
}
