import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/tectonic-for-the-win/',
  plugins: [react(), tailwindcss()],
})
