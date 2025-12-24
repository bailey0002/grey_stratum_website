import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ensure correct base path when hosted under /protocols/pitchprep/
// Adjust "base" to match your deployment URL prefix.
export default defineConfig({
  plugins: [react()],
  base: '/protocols/pitchprep/'
})
