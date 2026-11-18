import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// 小程序插件只能在已注册的 AppID 下使用，测试号里声明了插件会编译失败。
// 开发包（dev:mp-weixin、build:mp-weixin:dev）去掉 app.json 里的插件声明，只有正式打包才带上。
function pluginsOnlyInProduction(production: boolean): Plugin {
  return {
    name: 'plugins-only-in-production',
    enforce: 'post',
    generateBundle(_options, bundle) {
      if (production) return
      const asset = bundle['app.json']
      if (!asset || asset.type !== 'asset') return
      const app = JSON.parse(String(asset.source))
      delete app.plugins
      for (const pkg of app.subPackages || []) delete pkg.plugins
      asset.source = JSON.stringify(app, null, 2)
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [uni(), pluginsOnlyInProduction(mode === 'production')],
  define: {
    __SOLAR_SPEECH__: JSON.stringify(mode === 'production'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@server-domain': path.resolve(__dirname, '../../server/src/domain'),
      // three.js 只给「3D 太阳系」分包用，指向复制进分包的副本，避免被打进主包，见 scripts/vendor-three.mjs
      three: path.resolve(__dirname, 'src/subsolar/vendor/three.js'),
    },
  },
  esbuild: mode === 'production'
    ? { drop: ['debugger'], pure: ['console.log', 'console.debug', 'console.info'], legalComments: 'none' }
    : undefined,
}))
