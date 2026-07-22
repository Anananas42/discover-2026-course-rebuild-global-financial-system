import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { PORTS } from '../shared/ports.ts';

export default defineConfig({
  // The guide API server watches this whole app directory (see start.ts),
  // and the default cache location (node_modules/.vite) is inside it — a
  // dep (re)optimization would restart the API mid-page-load. The root
  // node_modules is outside every watched path.
  cacheDir: '../../node_modules/.vite/guide',
  plugins: [react(), tailwindcss()],
  server: {
    port: PORTS.guide,
    strictPort: true,
    // The guide API serves its routes under /api directly — plain
    // passthrough, no rewrite.
    proxy: {
      '/api': `http://localhost:${PORTS.guideApi}`,
    },
  },
});
