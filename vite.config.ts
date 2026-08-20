import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { captionsApiPlugin } from './server/captionsPlugin.js'

export default defineConfig({
  plugins: [react(), tailwindcss(), captionsApiPlugin()],
})
