import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ensure correct base path when hosted under /protocols/instrumentum-003/
// Adjust "base" to match your deployment URL prefix.
export default defineConfig({
  plugins: [react()],
  base: '/protocols/instrumentum-003/'
})
