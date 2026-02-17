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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          zustand: ['zustand'],
          radix: ['radix-ui'],
          lucide: ['lucide-react'],
          swr: ['swr'],
          vaul: ['vaul'],
          dateFns: ['date-fns'],
          uuid: ['uuid'],
          reactWindow: ['react-window', 'react-virtualized-auto-sizer'],
          toast: ['react-hot-toast'],
          cva: ['class-variance-authority', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
})
