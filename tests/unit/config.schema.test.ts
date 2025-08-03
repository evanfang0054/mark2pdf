import { describe, it, expect } from 'vitest';
import { configSchema } from '@/config/schema';

describe('Config Schema Validation', () => {
  it('should validate a correct config', () => {
    const validConfig = {
      input: { path: './md' },
      output: { path: './pdf' },
      options: { concurrent: 3 }
    };

    expect(() => configSchema.parse(validConfig)).not.toThrow();
  });

  it('should apply default values', () => {
    const minimalConfig = {};
    const parsed = configSchema.parse(minimalConfig);

    expect(parsed.input.path).toBe('./public/md');
    expect(parsed.output.path).toBe('./dist/pdf');
    expect(parsed.options.concurrent).toBe(3);
    expect(parsed.options.format).toBe('A4');
    expect(parsed.features?.incremental).toBe(true);
  });

  it('should reject invalid concurrent number', () => {
    const invalidConfig = {
      input: { path: './md' },
      output: { path: './pdf' },
      options: { concurrent: 11 }
    };

    expect(() => configSchema.parse(invalidConfig)).toThrow();
  });

  it('should reject invalid format', () => {
    const invalidConfig = {
      input: { path: './md' },
      output: { path: './pdf' },
      options: { format: 'INVALID' }
    };

    expect(() => configSchema.parse(invalidConfig)).toThrow();
  });

  it('should validate nested optional fields', () => {
    const configWithWatermark = {
      input: { path: './md' },
      output: { path: './pdf' },
      options: {
        watermark: {
          text: 'Confidential',
          opacity: 0.5
        }
      }
    };

    expect(() => configSchema.parse(configWithWatermark)).not.toThrow();
  });

  it('should reject invalid watermark opacity', () => {
    const invalidConfig = {
      input: { path: './md' },
      output: { path: './pdf' },
      options: {
        watermark: {
          opacity: 1.5
        }
      }
    };

    expect(() => configSchema.parse(invalidConfig)).toThrow();
  });

  it('should validate file filters', () => {
    const configWithFilters = {
      input: {
        path: './md',
        filters: {
          include: ['.*\\.md$'],
          exclude: ['.*_draft\\.md$']
        }
      },
      output: { path: './pdf' }
    };

    expect(() => configSchema.parse(configWithFilters)).not.toThrow();
  });
});
