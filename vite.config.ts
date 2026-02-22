import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
  },
})
