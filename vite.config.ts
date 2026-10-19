import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Copy a compact graph.json into public/ (source of truth stays pretty data/graph.json). */
function copyGraphPlugin() {
  return {
    name: 'copy-graph-json',
    buildStart() {
      const src = resolve('data/graph.json');
      const dest = resolve('public/data/graph.json');
      const pretty = readFileSync(src, 'utf8');
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, JSON.stringify(JSON.parse(pretty)));
    },
  };
}

export default defineConfig({
  plugins: [react(), copyGraphPlugin()],
  base: process.env.VITE_BASE_PATH || '/',
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
});
