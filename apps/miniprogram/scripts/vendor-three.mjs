// 把 three.js 复制进 src/subsolar/vendor/，vite.config.ts 把 'three' 指到这里。
// uni-app 会把 node_modules 里的包都打进主包 common/vendor.js，放进分包目录才会跟着「3D 太阳系」分包走。
// 生成的文件不入库，dev / build 脚本会先跑这一步。three.js 是 MIT 许可，保留它的版权声明。
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkgDir = path.resolve(path.dirname(require.resolve('three')), '..')
const source = path.join(pkgDir, 'build/three.module.js')
const outDir = path.join(root, 'src/subsolar/vendor')
const output = path.join(outDir, 'three.js')

mkdirSync(outDir, { recursive: true })
if (!existsSync(output) || statSync(output).mtimeMs < statSync(source).mtimeMs) {
  copyFileSync(source, output)
  copyFileSync(path.join(pkgDir, 'LICENSE'), path.join(outDir, 'THREE-LICENSE.txt'))
  const { version } = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'))
  writeFileSync(path.join(outDir, 'README.md'), `three.js ${version}，由 scripts/vendor-three.mjs 从 node_modules 复制，不要手改、不要提交。\n`)
  console.log(`[three] 已复制 three.js ${version} 到 src/subsolar/vendor/`)
}

// 小程序里全局 self 是 null。three.js 把动画上下文设成 self，页面卸载时
// WebGLRenderer.dispose() 调 animation.stop()，就会读 null.cancelAnimationFrame。
const bundled = readFileSync(output, 'utf8')
const stop = 'context.cancelAnimationFrame( requestId );'
const guarded = 'if ( context ) context.cancelAnimationFrame( requestId );'
if (bundled.includes(stop) && !bundled.includes(guarded)) {
  writeFileSync(output, bundled.replace(stop, guarded))
  console.log('[three] 已补上动画停止的空判断')
}
