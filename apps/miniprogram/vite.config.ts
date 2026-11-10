import path from 'node:path'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig(({ mode }) => ({
  plugins: [uni()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@server-domain': path.resolve(__dirname, '../../server/src/domain'),
    },
  },
  esbuild: mode === 'production'
    ? { drop: ['debugger'], pure: ['console.log', 'console.debug', 'console.info'], legalComments: 'none' }
    : undefined,
}))
