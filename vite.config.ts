import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    chunkSizeWarningLimit: 2600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'charts': ['recharts'],
          'icons': ['lucide-react'],
          'qr': ['qrcode.react', '@zxing/browser'],
          'pdf': ['jspdf', 'jspdf-autotable'],
          'utils': ['date-fns', 'papaparse', 'signature_pad', 'clsx', 'tailwind-merge', 'uuid'],
        },
      },
    },
  },
});
