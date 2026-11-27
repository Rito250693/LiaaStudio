import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { liaaCmsPlugin } from './server/cmsMiddleware.mjs';

export default defineConfig({
  plugins: [react(), tailwindcss(), liaaCmsPlugin()],
  server: {
    fs: {
      deny: ['.env', '.env.*', 'server/data/**', 'backups/**', '**/.git/**'],
    },
  },
});
