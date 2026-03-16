import { sentryVitePlugin } from "@sentry/vite-plugin";
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), sentryVitePlugin({
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    release: {
      name: `otter-music@${pkg.version}`,
    },
  })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      'lucide-react',
      'date-fns',
    ],
  },
  build: {
    minify: 'esbuild',
    target: 'es2018',
    cssMinify: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor'
            }
          }
        },
      },
    },
    sourcemap: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
  server: {
    proxy: {
      '/api/netease': {
        target: 'https://music.163.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/netease/, ''),
        headers: {
          'Referer': 'https://music.163.com',
          'Origin': 'https://music.163.com'
        },
        // 添加 configure 钩子拦截并替换 Headers
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // 1. 还原 Cookie
            if (req.headers['x-real-cookie']) {
              proxyReq.setHeader('Cookie', req.headers['x-real-cookie']);
            }
            // 2. 还原 User-Agent
            if (req.headers['x-real-ua']) {
              proxyReq.setHeader('User-Agent', req.headers['x-real-ua']);
            }
            // 3. 还原伪装 IP
            if (req.headers['x-real-ip']) {
              proxyReq.setHeader('X-Real-IP', req.headers['x-real-ip']);
              proxyReq.setHeader('X-Forwarded-For', req.headers['x-real-ip']);
            }

            // 4. 清理前端发送的自定义 Header，防止被网易云识别为爬虫特征
            proxyReq.removeHeader('x-real-cookie');
            proxyReq.removeHeader('x-real-ua');
          });
        }
      }
    }
  }
})