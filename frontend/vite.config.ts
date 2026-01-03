/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Custom plugin to copy fixture files to public directory
function copyFixturesPlugin() {
  return {
    name: 'copy-fixtures',
    writeBundle() {
      const fixturesDir = path.resolve(__dirname, '../specs/005-indicator-parity/fixtures')
      const publicFixturesDir = path.resolve(__dirname, 'public/fixtures')

      // Create public/fixtures directory if it doesn't exist
      if (!fs.existsSync(publicFixturesDir)) {
        fs.mkdirSync(publicFixturesDir, { recursive: true })
      }

      // Copy all JSON fixture files
      if (fs.existsSync(fixturesDir)) {
        const files = fs.readdirSync(fixturesDir)
        const jsonFiles = files.filter(f => f.endsWith('.json'))

        jsonFiles.forEach(file => {
          const src = path.join(fixturesDir, file)
          const dest = path.join(publicFixturesDir, file)
          fs.copyFileSync(src, dest)
          console.log(`Copied fixture: ${file}`)
        })

        console.log(`Copied ${jsonFiles.length} fixture files to public/fixtures/`)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/PolishedCharts/',  // 👈 ADD THIS LINE
  plugins: [
    react(),
    copyFixturesPlugin()
  ],
  optimizeDeps: {
    exclude: ['lightweight-charts']
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // COEP/COOP headers removed - they were breaking Firebase auth
    // If you need SharedArrayBuffer support, you'll need a different approach
    // headers: {
    //   'Cross-Origin-Opener-Policy': 'same-origin',
    //   'Cross-Origin-Embedder-Policy': 'credentialless',
    // },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // In dev mode, serve fixtures from specs directory
      '/fixtures': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path: string) => {
          // Serve from specs directory during development
          return path.replace(/^\/fixtures/, '/specs/005-indicator-parity/fixtures')
        }
      }
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
} as any)
