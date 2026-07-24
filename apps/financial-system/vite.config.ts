import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { PORTS } from '../shared/ports.ts';

export default defineConfig({
  // The financial system API server watches this whole app directory (see
  // start.ts), and the default cache location (node_modules/.vite) is
  // inside it — a dep (re)optimization would restart the API mid-page-load.
  // The root node_modules is outside every watched path.
  cacheDir: '../../node_modules/.vite/financial-system',
  plugins: [react(), tailwindcss()],
  server: {
    port: PORTS.financialSystem,
    strictPort: true,
    proxy: {
      // The tRPC server serves procedures at its root; the /api prefix
      // exists only on the frontend side and is stripped here.
      '/api': {
        target: `http://localhost:${PORTS.financialSystemApi}`,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
});
