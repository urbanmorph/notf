import { defineConfig } from 'vite';

export default defineConfig({
  root: 'public',
  server: {
    port: 5173,
    // Mirror the production Vercel rewrite so the same-origin /api/supabase/*
    // path works in dev too (see website/public/assets/js/data-loader.js).
    proxy: {
      '/api/supabase': {
        target: 'https://abblyaukkoxmgzwretvm.supabase.co',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/supabase/, ''),
      },
    },
  },
});
