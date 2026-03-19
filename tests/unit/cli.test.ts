import { describe, it, expect, vi, afterEach } from 'vitest';
import { CLIHandler } from '@/cli/handler';
import { createProgram, runCli } from '@/bin/mark2pdf';

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

describe('CLI arg_parse handling', () => {
  it('returns exit code 1 for invalid option and skips handler execution', async () => {
    let handlerCalled = false;
    const fakeHandler = async () => {
      handlerCalled = true;
    };

    const exitCode = await runCli(['node', 'mark2pdf', 'convert', '--unknown-option'], fakeHandler);

    expect(exitCode).toBe(1);
    expect(handlerCalled).toBe(false);
  });

  it('keeps output option without hardcoded default value', () => {
    const program = createProgram(async () => undefined);
    const convert = program.commands.find((command) => command.name() === 'convert');

    expect(convert).toBeDefined();

    const outputOption = convert!.options.find((option) => option.long === '--output');

    expect(outputOption).toBeDefined();
    expect(outputOption!.defaultValue).toBeUndefined();
  });
});

describe('CLI output/report policy helpers', () => {
  const handler = CLIHandler as any;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers command-scoped default output when config source is default', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/tmp/ws');

    const outputPath = handler._resolveOutputPath(
      'merge',
      { output: undefined },
      { output: { path: './dist/pdf' } },
      { 'output.path': 'default' }
    );

    expect(outputPath).toBe('/tmp/ws/output/merge');
  });

  it('keeps config output when it comes from non-default source', () => {
    const outputPath = handler._resolveOutputPath(
      'convert',
      { output: undefined },
      { output: { path: './custom-config-output' } },
      { 'output.path': 'file' }
    );

    expect(outputPath).toBe('./custom-config-output');
  });

  it('builds latest report with required schema fields', () => {
    const report = handler._buildLatestExecutionReport({
      command: 'convert',
      status: 'failed',
      stage: 'execute',
      startedAt: new Date('2026-03-19T10:00:00.000Z'),
      endedAt: new Date('2026-03-19T10:00:01.000Z'),
      inputPath: './input',
      outputPath: './output/convert',
      errorMessage: 'boom',
    });

    expect(report).toMatchObject({
      runId: expect.any(String),
      command: 'convert',
      status: 'failed',
      stage: 'execute',
      startedAt: '2026-03-19T10:00:00.000Z',
      endedAt: '2026-03-19T10:00:01.000Z',
      inputPath: './input',
      outputPath: './output/convert',
      errorMessage: 'boom',
    });
  });

  it('prints one-line failure summary with stage and latest report path', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    handler._printFailureSummary('convert', 'input_validate', 'output/convert/_latest-report.json');

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('❌ convert 失败（阶段：input_validate），详情：output/convert/_latest-report.json')
    );
  });
});
