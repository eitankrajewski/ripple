import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { explainDevMiddleware } from './server/devExplain.ts'

export default defineConfig({
  plugins: [react(), tailwindcss(), explainDevMiddleware()],
  build: { chunkSizeWarningLimit: 900 },
})
