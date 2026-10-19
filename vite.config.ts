import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { weddingMeta } from './build/weddingMeta'

// The app uses hash-based routing (/#/rsvp), so a relative base path works for
// both a project page (https://user.github.io/repo/) and a custom domain.
// Override with VITE_BASE_PATH if you ever need an absolute base.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE_PATH ?? './',
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
