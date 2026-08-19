import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const outDirs: Record<string, string> = {
    catalog: 'dist-catalog',
    suite: 'dist-suite',
    sell: 'dist-sell',
    stock: 'dist-stock',
    ops: 'dist-ops',
    talk: 'dist-talk',
    logistics: 'dist-logistics',
    calendar: 'dist-calendar',
  };

  const productHtml = resolve(__dirname, `index.${mode}.html`);
  const htmlInput = existsSync(productHtml)
    ? productHtml
    : resolve(__dirname, 'index.html');

  return {
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@xenova/transformers', 'tesseract.js'],
  },
  worker: {
    format: 'es',
  },
  build: {
    outDir: outDirs[mode] ?? 'dist',
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      input: htmlInput,
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('html5-qrcode')) return 'qrcode';
          if (id.includes('jsbarcode')) return 'barcode';
          if (id.includes('fuse.js')) return 'fuse';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('react-dom') || id.includes('/react/')) return 'react';
          if (id.includes('leaflet')) return 'leaflet';
          if (id.includes('recharts')) return 'recharts';
          if (id.includes('@xenova/transformers')) return 'transformers';
        },
      },
    },
  },
};
});
