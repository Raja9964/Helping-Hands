import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 20_000,
    // The first run downloads a MongoDB binary.
    hookTimeout: 120_000,
  },
});
