import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'lcov'],
      exclude: [
        '**/*.d.ts',
        '**/node_modules/**',
        'tests/**',
        'dist/**',
        'coverage/**'
      ]
    },
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/config': path.resolve(__dirname, './src/config'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/scripts': path.resolve(__dirname, './src/scripts'),
      '@/cli': path.resolve(__dirname, './src/cli'),
      '@/bin': path.resolve(__dirname, './src/bin')
    }
  }
});