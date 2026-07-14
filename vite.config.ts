import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('xlsx')) return 'xlsx'
          if (id.includes('react-dom') || id.includes('react/')) return 'vendor'
        },
      },
    },
  },
})
