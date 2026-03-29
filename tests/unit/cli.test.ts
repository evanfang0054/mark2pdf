import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { MockInstance } from 'vitest';
import chalk from 'chalk';
import fs from 'fs/promises';
import { CLIHandler } from '@/cli/handler';
import { createProgram, runCli } from '@/bin/mark2pdf';
import { ConverterService } from '@/services/converter';
import { HtmlConverterService } from '@/services/htmlConverter';
import { ConfigLoader } from '@/config/loader';

const handler = CLIHandler as any;
const baseLoadedConfig = {
  effectiveConfig: {
    input: { path: './docs', extensions: ['.md'] },
    output: { path: './dist', createDirIfNotExist: true, maintainDirStructure: true },
    options: { format: 'A4' },
  },
  sources: { 'output.path': 'default' },
} as const;

function mockExit(): MockInstance {
  return vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('Process exited with code 1');
  }) as any);
}

function mockConfigLoad() {
  return vi.spyOn(ConfigLoader, 'loadConfigWithTrace').mockResolvedValue(baseLoadedConfig as any);
}

function mockSuccessfulConvert(report = {
  command: 'convert',
  total: 0,
  success: 0,
  failed: 0,
  durationMs: 0,
  failedDetails: [],
}) {
  vi.spyOn(handler, '_isFirstRun').mockResolvedValue(false);
  vi.spyOn(handler, '_handleConvertUnified').mockResolvedValue(report);
  vi.spyOn(handler, '_writeLatestReport').mockResolvedValue(undefined);
  return report;
}

describe('CLIHandler (P0/P1)', () => {

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
      expect(deprecations[0]).toMatchObject({
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

  it('merges global flags into convert action options', async () => {
    const calls: Array<{ command: string; options: Record<string, unknown> }> = [];

    const exitCode = await runCli(
      ['node', 'mark2pdf', '--json', '--quiet', '--verbose', '--no-input', '--limit', '7', 'convert', '--dry-run'],
      async (command, options) => {
        calls.push({ command, options });
      }
    );

    expect(exitCode).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: 'convert',
      options: {
        json: true,
        quiet: true,
        verbose: true,
        limit: 7,
        dryRun: true,
      },
    });
  });

  it('passes extract out-format and deprecated format options through CLI parsing', async () => {
    const calls: Array<{ command: string; options: Record<string, unknown> }> = [];

    await runCli(
      ['node', 'mark2pdf', 'extract', '--out-format', 'json', '--format', 'md'],
      async (command, options) => {
        calls.push({ command, options });
      }
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: 'extract',
      options: {
        outFormat: 'json',
        format: 'md',
      },
    });
  });
});

describe('CLI output/report policy helpers', () => {
  const jsonOutput = { isJsonMode: () => false } as any;
  const convertConfig = {
    input: { path: '/input', extensions: ['.md'] },
    output: { path: '/output', createDirIfNotExist: true, maintainDirStructure: true },
    options: { format: 'A4' },
  } as any;

  afterEach(() => {
    vi.restoreAllMocks();
    chalk.level = 1;
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

    handler._printFailureSummary('convert', 'input_validate', 'output/convert/_latest-report.json', jsonOutput);

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('❌ convert 失败（阶段：input_validate），详情：output/convert/_latest-report.json')
    );
  });

  it('prints dry-run plan as structured JSON in JSON mode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    handler._printDryRunPlan(
      {
        inputRoot: '/input',
        outputRoot: '/output',
        items: [
          {
            action: 'convert-md',
            inputPath: '/input/a.md',
            targetPath: '/output/a.pdf',
            type: 'md',
          },
        ],
      },
      true,
      true
    );

    expect(spy).toHaveBeenCalledWith(
      JSON.stringify({
        dry_run: true,
        input: '/input',
        output: '/output',
        total_files: 1,
        has_more: true,
        items: [
          {
            action: 'convert-md',
            input: '/input/a.md',
            output: '/output/a.pdf',
            reason: undefined,
          },
        ],
      })
    );
  });

  it('prints effective config as structured JSON in JSON mode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const structuredOutput = { isJsonMode: () => true } as any;
    const config = {
      input: { path: './docs', extensions: ['.md'] },
      output: { path: './dist' },
    } as any;
    const sources = {
      'input.path': 'cli',
      'input.extensions': 'default',
      'output.path': 'file',
    } as any;

    handler._printEffectiveConfig(config, sources, structuredOutput);

    expect(spy).toHaveBeenCalledWith(
      JSON.stringify({
        config,
        sources,
      })
    );
  });

  it('writes structured report file and suppresses console output in quiet/json mode', async () => {
    const mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined as any);
    const writeSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const suppressedOutput = { shouldSuppressOutput: () => true } as any;
    const report = {
      command: 'convert',
      total: 1,
      success: 1,
      failed: 0,
      durationMs: 5,
      failedDetails: [],
    };

    await handler._writeStructuredReport('/tmp/output/report.json', report, suppressedOutput);

    expect(mkdirSpy).toHaveBeenCalledWith('/tmp/output', { recursive: true });
    expect(writeSpy).toHaveBeenCalledWith('/tmp/output/report.json', JSON.stringify(report, null, 2), 'utf-8');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('prints structured json error and suppresses human failure summary on CLI handler failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = mockExit();

    mockConfigLoad();
    vi.spyOn(handler, '_isFirstRun').mockResolvedValue(false);
    vi.spyOn(handler, '_handleConvertUnified').mockRejectedValue(new Error('invalid option --broken'));
    vi.spyOn(handler, '_writeLatestReport').mockResolvedValue(undefined);

    await expect(CLIHandler.handleCommand('convert', { json: true, input: './docs' })).rejects.toThrow('Process exited with code 1');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(JSON.stringify({
      error: 'argument',
      message: 'invalid option --broken',
      hint: 'mark2pdf --help',
    }));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints human-readable cli error on CLI handler failure outside json mode', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = mockExit();

    mockConfigLoad();
    vi.spyOn(handler, '_isFirstRun').mockResolvedValue(false);
    vi.spyOn(handler, '_handleConvertUnified').mockRejectedValue(new Error('ENOENT: no such file or directory'));
    vi.spyOn(handler, '_writeLatestReport').mockResolvedValue(undefined);

    await expect(CLIHandler.handleCommand('convert', { input: './docs' })).rejects.toThrow('Process exited with code 1');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ convert 失败（阶段：execute）'));
    expect(errorSpy).toHaveBeenCalledWith(
      '[CLI_ERROR]\n类别: path\n摘要: ENOENT: no such file or directory\n建议: mark2pdf convert --show-config'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('applies NO_COLOR environment flag during option normalization', () => {
    process.env.NO_COLOR = '1';

    const { unifiedOptions } = handler._normalizeCliOptions({});

    expect(unifiedOptions.noColor).toBe(true);

    delete process.env.NO_COLOR;
  });

  it('skips setup wizard when --no-input is enabled on first run', async () => {
    const loadConfigSpy = mockConfigLoad();
    const isFirstRunSpy = vi.spyOn(handler, '_isFirstRun').mockResolvedValue(true);
    const wizardSpy = vi.spyOn(handler, '_runSetupWizard').mockResolvedValue(undefined);
    const convertSpy = vi.spyOn(handler, '_handleConvertUnified').mockResolvedValue({
      command: 'convert',
      total: 0,
      success: 0,
      failed: 0,
      durationMs: 0,
      failedDetails: [],
    });
    const latestReportSpy = vi.spyOn(handler, '_writeLatestReport').mockResolvedValue(undefined);

    await CLIHandler.handleCommand('convert', { noInput: true, input: './docs' });

    expect(loadConfigSpy).toHaveBeenCalled();
    expect(isFirstRunSpy).not.toHaveBeenCalled();
    expect(wizardSpy).not.toHaveBeenCalled();
    expect(convertSpy).toHaveBeenCalled();
    expect(latestReportSpy).toHaveBeenCalled();
  });

  it('suppresses success summary when quiet mode is enabled through CLI handler', async () => {
    mockConfigLoad();
    mockSuccessfulConvert({
      command: 'convert',
      total: 1,
      success: 1,
      failed: 0,
      durationMs: 1,
      failedDetails: [],
    });
    const successSpy = vi.spyOn(handler, '_printSuccessSummary').mockImplementation(() => undefined);

    await CLIHandler.handleCommand('convert', { quiet: true, input: './docs' });

    expect(successSpy).toHaveBeenCalledWith(
      'convert',
      expect.stringContaining('/output/convert'),
      expect.objectContaining({
        isJsonMode: expect.any(Function),
        shouldSuppressOutput: expect.any(Function),
      })
    );
    expect(successSpy.mock.calls[0][2].shouldSuppressOutput()).toBe(true);
    expect(successSpy.mock.calls[0][2].isJsonMode()).toBe(false);
  });

  it('passes verbose flag to progress indicator through CLI handler', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    mockConfigLoad();
    const convertSpy = vi.spyOn(handler, '_handleConvertUnified').mockImplementation(async (_config: any, progressArg: any) => {
      progressArg.info('verbose-message');
      return {
        command: 'convert',
        total: 0,
        success: 0,
        failed: 0,
        durationMs: 0,
        failedDetails: [],
      };
    });
    vi.spyOn(handler, '_isFirstRun').mockResolvedValue(false);
    vi.spyOn(handler, '_writeLatestReport').mockResolvedValue(undefined);

    await CLIHandler.handleCommand('convert', { verbose: true, input: './docs' });

    expect(convertSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(expect.any(String), 'verbose-message');
  });

  it('passes json flag to CLI output pipeline through CLI handler', async () => {
    const printConfigSpy = vi.spyOn(handler, '_printEffectiveConfig').mockImplementation(() => undefined);
    mockConfigLoad();
    mockSuccessfulConvert();

    await CLIHandler.handleCommand('convert', { json: true, showConfig: true, input: './docs' });

    expect(printConfigSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({
        isJsonMode: expect.any(Function),
        shouldSuppressOutput: expect.any(Function),
      })
    );
    expect(printConfigSpy.mock.calls[0][2].isJsonMode()).toBe(true);
    expect(printConfigSpy.mock.calls[0][2].shouldSuppressOutput()).toBe(true);
  });

  it('disables chalk color when noColor option is enabled through CLI handler', async () => {
    mockConfigLoad();
    mockSuccessfulConvert();

    chalk.level = 3;
    await CLIHandler.handleCommand('convert', { noColor: true, input: './docs' });

    expect(chalk.level).toBe(0);
  });

  it('prints effective config in human-readable mode through CLI handler', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(ConfigLoader, 'loadConfigWithTrace').mockResolvedValue({
      effectiveConfig: {
        input: { path: './docs', extensions: ['.md'] },
        output: { path: './dist', createDirIfNotExist: true, maintainDirStructure: true },
        options: { format: 'A4' },
      },
      sources: { 'input.path': 'cli', 'output.path': 'default', 'options.format': 'file' },
    });
    mockSuccessfulConvert();

    await CLIHandler.handleCommand('convert', { showConfig: true, input: './docs' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('🧭 生效配置（含来源）'));
  });

  it('writes report-json through CLI handler execution path', async () => {
    const report = mockSuccessfulConvert({
      command: 'convert',
      total: 1,
      success: 1,
      failed: 0,
      durationMs: 1,
      failedDetails: [],
    });
    mockConfigLoad();
    const reportSpy = vi.spyOn(handler, '_writeStructuredReport').mockResolvedValue(undefined);

    await CLIHandler.handleCommand('convert', {
      input: './docs',
      reportJson: '/tmp/mark2pdf-report.json',
    });

    expect(reportSpy).toHaveBeenCalledWith(
      '/tmp/mark2pdf-report.json',
      report,
      expect.objectContaining({
        isJsonMode: expect.any(Function),
        shouldSuppressOutput: expect.any(Function),
      })
    );
  });

  it('prints human dry-run summary with limit truncation through convert execution flow', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.spyOn(handler, '_buildConvertExecutionPlan').mockResolvedValue({
      inputRoot: '/input',
      outputRoot: '/output',
      items: [
        { inputPath: '/input/a.md', type: 'md', action: 'convert-md', targetPath: '/output/a.pdf' },
        { inputPath: '/input/b.md', type: 'md', action: 'convert-md', targetPath: '/output/b.pdf' },
        { inputPath: '/input/c.html', type: 'html', action: 'convert-html', targetPath: '/output/c.pdf' },
      ],
    });

    const report = await handler._handleConvertUnified(
      convertConfig,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
      { dryRun: true, limit: 2, json: false }
    );

    expect(report).toMatchObject({ total: 2, success: 0, failed: 0 });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('... 已按 --limit 截断，仍有更多文件未展示'));
  });

  it('treats limit 0 as unlimited during convert execution', async () => {
    vi.spyOn(handler, '_buildConvertExecutionPlan').mockResolvedValue({
      inputRoot: '/input',
      outputRoot: '/output',
      items: [
        { inputPath: '/input/a.md', type: 'md', action: 'convert-md', targetPath: '/output/a.pdf' },
        { inputPath: '/input/b.md', type: 'md', action: 'convert-md', targetPath: '/output/b.pdf' },
        { inputPath: '/input/c.html', type: 'html', action: 'convert-html', targetPath: '/output/c.pdf' },
      ],
    });

    const markdownSpy = vi.spyOn(ConverterService.prototype, 'convertFiles').mockResolvedValue({
      total: 2,
      success: 2,
      failed: 0,
      duration: 1,
      failedFiles: [],
    });
    const htmlSpy = vi.spyOn(HtmlConverterService.prototype, 'convertFiles').mockResolvedValue({
      total: 1,
      success: 1,
      failed: 0,
      duration: 1,
      failedFiles: [],
    });

    const report = await handler._handleConvertUnified(convertConfig, { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any, { limit: 0 });

    expect(markdownSpy).toHaveBeenCalledWith(['/input/a.md', '/input/b.md']);
    expect(htmlSpy).toHaveBeenCalledWith(['/input/c.html'], '/input', '/output');
    expect(report).toMatchObject({ total: 3, success: 3, failed: 0 });
  });
});


describe('CLI convert limit execution', () => {
  const handler = CLIHandler as any;
  const progress = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
  const config = {
    input: { path: '/input', extensions: ['.md'] },
    output: { path: '/output', createDirIfNotExist: true, maintainDirStructure: true },
    options: { format: 'A4' },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes only the limited markdown and html plan items', async () => {
    vi.spyOn(handler, '_buildConvertExecutionPlan').mockResolvedValue({
      inputRoot: '/input',
      outputRoot: '/output',
      items: [
        { inputPath: '/input/a.md', type: 'md', action: 'convert-md', targetPath: '/output/a.pdf' },
        { inputPath: '/input/b.md', type: 'md', action: 'convert-md', targetPath: '/output/b.pdf' },
        { inputPath: '/input/c.html', type: 'html', action: 'convert-html', targetPath: '/output/c.pdf' },
        { inputPath: '/input/d.html', type: 'html', action: 'convert-html', targetPath: '/output/d.pdf' },
      ],
    });

    const markdownSpy = vi.spyOn(ConverterService.prototype, 'convertFiles').mockResolvedValue({
      total: 2,
      success: 2,
      failed: 0,
      duration: 1,
      failedFiles: [],
    });
    const markdownAllSpy = vi.spyOn(ConverterService.prototype, 'convertAll').mockResolvedValue({
      total: 99,
      success: 99,
      failed: 0,
      duration: 1,
      failedFiles: [],
    });
    const htmlSpy = vi.spyOn(HtmlConverterService.prototype, 'convertFiles').mockResolvedValue({
      total: 1,
      success: 1,
      failed: 0,
      duration: 1,
      failedFiles: [],
    });
    const htmlAllSpy = vi.spyOn(HtmlConverterService.prototype, 'convertAll').mockResolvedValue({
      total: 99,
      success: 99,
      failed: 0,
      duration: 1,
      failedFiles: [],
    });

    const report = await handler._handleConvertUnified(config, progress, { limit: 3 });

    expect(markdownSpy).toHaveBeenCalledWith(['/input/a.md', '/input/b.md']);
    expect(htmlSpy).toHaveBeenCalledWith(['/input/c.html'], '/input', '/output');
    expect(markdownAllSpy).not.toHaveBeenCalled();
    expect(htmlAllSpy).not.toHaveBeenCalled();
    expect(report).toMatchObject({ total: 3, success: 3, failed: 0 });
  });
});
