import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Custom plugin to copy fixture files to public directory
function copyFixturesPlugin() {
  return {
    name: 'copy-fixtures',
    writeBundle() {
      const fixturesDir = path.resolve(
        __dirname,
        '../specs/005-indicator-parity/fixtures',
      )
      const publicFixturesDir = path.resolve(__dirname, 'public/fixtures')

      // Create public/fixtures directory if it doesn't exist
      if (!fs.existsSync(publicFixturesDir)) {
        fs.mkdirSync(publicFixturesDir, { recursive: true })
      }

      // Copy all JSON fixture files
      if (fs.existsSync(fixturesDir)) {
        const files = fs.readdirSync(fixturesDir)
        const jsonFiles = files.filter((f) => f.endsWith('.json'))

        jsonFiles.forEach((file) => {
          const src = path.join(fixturesDir, file)
          const dest = path.join(publicFixturesDir, file)
          fs.copyFileSync(src, dest)
          console.log(`Copied fixture: ${file}`)
        })

        console.log(
          `Copied ${jsonFiles.length} fixture files to public/fixtures/`,
        )
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/PolishedCharts/',

  plugins: [react(), copyFixturesPlugin()],

  optimizeDeps: {
    exclude: ['lightweight-charts'],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    // Dev-only proxies (GitHub Pages has no localhost backend)
    proxy:
      process.env.NODE_ENV === 'development'
        ? {
            '/api': {
              target: 'http://localhost:8000',
              changeOrigin: true,
            },
            // In dev mode, serve fixtures from specs directory
            '/fixtures': {
              target: 'http://localhost:8080',
              changeOrigin: true,
              rewrite: (p: string) =>
                p.replace(/^\/fixtures/, '/specs/005-indicator-parity/fixtures'),
            },
          }
        : undefined,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/',
        'build/',
      ],
    },
  },
})
