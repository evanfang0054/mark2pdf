import { describe, it, expect } from 'vitest';
import { CLIHandler } from '@/cli/handler';

describe('CLIHandler (P0/P1)', () => {
  const handler = CLIHandler as any;

  describe('_normalizeCliOptions', () => {
    it('maps unified options directly', () => {
      const { unifiedOptions, deprecations } = handler._normalizeCliOptions({
        input: './docs',
        output: './dist',
        pageSize: 'A3',
        outFormat: 'md',
        dryRun: true,
        showConfig: true,
        reportJson: './dist/report.json',
        verbose: true,
      });

      expect(unifiedOptions.input).toBe('./docs');
      expect(unifiedOptions.output).toBe('./dist');
      expect(unifiedOptions.pageSize).toBe('A3');
      expect(unifiedOptions.outputFormat).toBe('md');
      expect(unifiedOptions.dryRun).toBe(true);
      expect(unifiedOptions.showConfig).toBe(true);
      expect(unifiedOptions.reportJson).toBe('./dist/report.json');
      expect(unifiedOptions.verbose).toBe(true);
      expect(deprecations).toEqual([]);
    });

    it('maps deprecated --format to --page-size and emits deprecation', () => {
      const { unifiedOptions, deprecations } = handler._normalizeCliOptions({
        format: 'Letter',
      });

      expect(unifiedOptions.pageSize).toBe('Letter');
      expect(deprecations).toHaveLength(1);
      expect(deprecations[0]).toEqual({
        legacy: '--format',
        replacement: '--page-size',
      });
    });
  });

  describe('_transformOptionsToConfig', () => {
    it('transforms CLI options to executable config', () => {
      const config = handler._transformOptionsToConfig({
        input: './docs',
        output: './dist',
        concurrent: 5,
        timeout: 60000,
        pageSize: 'A5',
        theme: 'modern',
      });

      expect(config.input).toEqual({ path: './docs', extensions: ['.md'] });
      expect(config.output).toEqual({
        path: './dist',
        createDirIfNotExist: true,
        maintainDirStructure: true,
      });
      expect(config.options).toMatchObject({
        concurrent: 5,
        timeout: 60000,
        format: 'A5',
        theme: 'modern',
      });
    });

    it('keeps config minimal when no option overrides are given', () => {
      const config = handler._transformOptionsToConfig({
        input: './docs',
      });

      expect(config.input?.path).toBe('./docs');
      expect(config.options).toBeUndefined();
    });
  });

  describe('_toActionableError', () => {
    it('classifies argument errors', () => {
      const actionable = handler._toActionableError(new Error('invalid option --foo'));
      expect(actionable.category).toBe('argument');
    });

    it('classifies path errors', () => {
      const actionable = handler._toActionableError(new Error('ENOENT: no such file or directory'));
      expect(actionable.category).toBe('path');
    });

    it('classifies permission errors', () => {
      const actionable = handler._toActionableError(new Error('EACCES: permission denied'));
      expect(actionable.category).toBe('permission');
    });

    it('falls back to runtime error', () => {
      const actionable = handler._toActionableError(new Error('unexpected failure'));
      expect(actionable.category).toBe('runtime');
    });
  });

  describe('report and sensitive masking helpers', () => {
    it('builds structured report fields correctly', () => {
      const report = handler._buildReport('convert', 10, 8, 2, 1200, [
        { file: './a.md', error: 'failed' },
      ]);

      expect(report).toEqual({
        command: 'convert',
        total: 10,
        success: 8,
        failed: 2,
        durationMs: 1200,
        failedDetails: [{ file: './a.md', error: 'failed' }],
      });
    });

    it('detects sensitive config paths', () => {
      expect(handler._isSensitivePath('auth.apiKey')).toBe(true);
      expect(handler._isSensitivePath('runtime.password')).toBe(true);
      expect(handler._isSensitivePath('output.path')).toBe(false);
    });
  });
});
