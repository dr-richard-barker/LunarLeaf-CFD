import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps asset paths relative so the built app works both at a domain
// root and under a GitHub Pages project sub-path.
export default defineConfig({
  plugins: [react()],
  base: './',
});
