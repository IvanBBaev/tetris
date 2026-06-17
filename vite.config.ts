/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
// Project GitHub Pages are served from /<repo>/, so the production base must match
// the repo name. Dev server and tests stay at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tetris/' : '/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
