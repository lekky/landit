import { defineConfig } from 'vitest/config';

/**
 * The social pipeline's own project, registered in the root config.
 *
 * Node environment and no setup: everything tested here is a pure function over
 * data that arrives already fetched, which is why `sources.mjs` (the network)
 * and `render.mjs` (the browser) are the only two files without coverage.
 */
export default defineConfig({
  test: {
    name: 'social',
    environment: 'node',
    include: ['*.test.js'],
  },
});
