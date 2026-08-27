import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative paths, so the same build serves from a domain root and from
  // /<repository>/ on GitHub Pages without being rebuilt.
  base: process.env.BASE_PATH ?? './',
  server: { port: process.env.PORT ? Number(process.env.PORT) : 5173 },
})
