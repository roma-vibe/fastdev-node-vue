import { defineConfig } from 'vitest/config';

// `npm test` runs every workspace's test project in one run.
export default defineConfig({
  test: {
    projects: ['server', 'web'],
  },
});
