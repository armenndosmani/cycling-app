import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for plain TypeScript modules (API client, session, helpers). They run in Node,
// so tested modules must not import react-native; mock Expo modules where needed.
export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }],
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
