import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Docker bind mounts on Windows may not forward file change events to Vite.
    watch: { usePolling: process.platform === 'linux', interval: 1000 },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
})

