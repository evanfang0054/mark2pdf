import { vi, beforeEach, afterEach } from 'vitest';

// Mock global console methods for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Mock process.exit to prevent actual exit during tests
process.exit = vi.fn((code?: number) => {
  throw new Error(`Process exited with code ${code}`);
});

// Setup test environment
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
