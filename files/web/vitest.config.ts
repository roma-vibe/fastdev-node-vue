import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineProject } from 'vitest/config';

export default defineProject({
  plugins: [vue()],
  define: {
    'import.meta.env.APP_NAME': JSON.stringify('Test App'),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    name: 'web',
    environment: 'happy-dom',
    // vite/*.test.ts cover the build-time helpers of vite.config.ts (Node environment).
    include: ['test/**/*.test.ts', 'vite/**/*.test.ts'],
  },
});
