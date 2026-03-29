import chalk from 'chalk';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonOutput } from '@/utils/jsonOutput';

describe('JsonOutput', () => {
  const originalChalkLevel = chalk.level;

  afterEach(() => {
    chalk.level = originalChalkLevel;
  });

  describe('mode helpers', () => {
    it('enables json mode and suppresses output when json is true', () => {
      const output = new JsonOutput({ json: true });

      expect(output.isJsonMode()).toBe(true);
      expect(output.shouldSuppressOutput()).toBe(true);
    });

    it('suppresses output in quiet mode without enabling json mode', () => {
      const output = new JsonOutput({ quiet: true });

      expect(output.isJsonMode()).toBe(false);
      expect(output.shouldSuppressOutput()).toBe(true);
    });

    it('does not suppress normal output by default', () => {
      const output = new JsonOutput({});

      expect(output.isJsonMode()).toBe(false);
      expect(output.shouldSuppressOutput()).toBe(false);
    });

    it('disables chalk colors in json mode', () => {
      chalk.level = 3;

      new JsonOutput({ json: true });

      expect(chalk.level).toBe(0);
    });
  });

  describe('formatList', () => {
    it('returns plain items outside json mode', () => {
      const output = new JsonOutput({});
      const items = ['a', 'b'];

      expect(output.formatList(items, 5, true)).toEqual(['a', 'b']);
    });

    it('returns structured list metadata in json mode', () => {
      const output = new JsonOutput({ json: true });
      const items = ['a', 'b'];

      expect(output.formatList(items, 5, true)).toEqual({
        items: ['a', 'b'],
        total: 5,
        processed: 2,
        has_more: true,
      });
    });
  });

  describe('formatError', () => {
    it('returns structured error object in json mode', () => {
      const output = new JsonOutput({ json: true });

      expect(output.formatError({
        category: 'path',
        summary: 'missing file',
        action: 'mark2pdf convert --show-config',
      })).toEqual({
        error: 'path',
        message: 'missing file',
        hint: 'mark2pdf convert --show-config',
      });
    });

    it('returns readable cli error text outside json mode', () => {
      const output = new JsonOutput({});

      expect(output.formatError({
        category: 'argument',
        summary: 'invalid option --foo',
        action: 'mark2pdf --help',
      })).toBe(
        '[CLI_ERROR]\n类别: argument\n摘要: invalid option --foo\n建议: mark2pdf --help'
      );
    });
  });
});
