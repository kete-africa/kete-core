import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The generic views as one self-contained page (MCP Apps): scripts and styles inlined, no request
// to any origin, built into dist/views.html.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    modulePreload: { polyfill: false },
    rollupOptions: { input: 'views.html' },
  },
});
