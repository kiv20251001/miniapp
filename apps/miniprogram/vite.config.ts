import path from 'node:path'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig(({ mode }) => ({
  plugins: [uni()],
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
