import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serve ở https://anhmy1312.github.io/internship_tracker/
  // → mọi asset phải có prefix /internship_tracker/, nếu không trang trắng (404 /assets/...).
  base: '/internship_tracker/',
  plugins: [react()],
})
