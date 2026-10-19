import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { weddingMeta } from './build/weddingMeta'

// Each baby shower has its own address (/<slug>/#/…), so the site's files are
// always loaded from the root ("/"). Override with VITE_BASE_PATH if the site
// ever moves into a sub-folder.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE_PATH ?? '/',
    plugins: [
      react(),
      tailwindcss(),
      weddingMeta({ supabaseUrl: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY, siteUrl: env.SITE_URL }),
    ],
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
            motion: ['framer-motion'],
            charts: ['recharts'],
          },
        },
      },
    },
  }
})
