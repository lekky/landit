import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@landit/core',
    include: ['src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
