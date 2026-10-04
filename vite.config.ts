import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          // Keep the rarely-changing vendor code in its own long-lived chunks so a
          // deploy that only touches app code does not re-download React or motion.
          // Matching on the resolved path catches react-dom/client and scheduler,
          // which the bare-specifier form leaves in the entry chunk.
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) return 'motion';
            if (id.includes('node_modules/@supabase')) return 'supabase';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify. File watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
