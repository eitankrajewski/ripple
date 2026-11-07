import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { explainDevMiddleware } from './server/devExplain.ts'

export default defineConfig(({ mode }) => {
  // Server-only keys (GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, RIPPLE_WEBHOOK_SECRET) for the dev API routes.
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) process.env[k] ??= v
  // Optional: serve a local Supabase (`supabase start`) through the dev server at /supabase,
  // so phones on the same network or a tunnel can reach it. Set VITE_SUPABASE_URL=/supabase.
  const target = process.env.SUPABASE_PROXY_TARGET
  return {
    server: target ? { proxy: { '/supabase': { target, ws: true, changeOrigin: true, rewrite: (p) => p.replace(/^\/supabase/, '') } } } : undefined,
    plugins: [react(), tailwindcss(), explainDevMiddleware()],
    build: { chunkSizeWarningLimit: 900 },
  }
})
