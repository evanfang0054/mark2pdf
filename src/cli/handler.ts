import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Mark2pdfConfig, OutputFormat } from '../config/schema';
import { ConfigLoader, ConfigSource } from '../config/loader';
import { ProgressIndicator } from '../utils/progress';
import { ConverterService } from '../services/converter';
import { MergerService } from '../services/merger';
import { HtmlConverterService } from '../services/htmlConverter';
import { PdfExtractor } from '../core/PdfExtractor';
import { DocxConverter } from '../core/DocxConverter';
import { detectInputType, InputType } from '../utils/inputDetector';
import { getAllFiles } from '../utils/fileUtils';
import { JsonOutput } from '../utils/jsonOutput';
import { ErrorFormatter } from '../utils/errorFormatter';
import { resolveDefaultOutputPath, resolveEffectiveOutputPath, resolveLatestReportPath, SupportedCommand } from './output-policy';

interface DeprecationEntry {
  legacy: string;
  replacement: string;
  note?: string;
}

interface UnifiedCLIOptions {
  input?: string;
  output?: string;
  config?: string;
  theme?: string;
  concurrent?: number;
  timeout?: number;
  pageSize?: 'A4' | 'Letter' | 'A3' | 'A5';
  outputFormat?: OutputFormat;
  dryRun?: boolean;
  showConfig?: boolean;
  reportJson?: string;
  verbose?: boolean;
  json?: boolean;
  quiet?: boolean;
  noColor?: boolean;
  noInput?: boolean;
  limit?: number;
}

interface ConvertPlanItem {
  inputPath: string;
  type: InputType;
  action: 'convert-md' | 'convert-html' | 'extract-docx' | 'extract-pdf' | 'skip';
  targetPath?: string;
  reason?: string;
}

interface ConvertExecutionPlan {
  inputRoot: string;
  outputRoot: string;
  items: ConvertPlanItem[];
}

interface ActionableError {
  category: 'path' | 'permission' | 'argument' | 'runtime';
  summary: string;
  action: string;
}

interface StructuredExecutionReport {
  command: string;
  total: number;
  success: number;
  failed: number;
  durationMs: number;
  failedDetails: Array<{ file: string; error: string }>;
}

type ExecutionStage = 'arg_parse' | 'input_validate' | 'execute' | 'write_output' | 'write_report';

type ExecutionStatus = 'success' | 'failed';

interface LatestExecutionReport {
  runId: string;
  command: SupportedCommand;
  status: ExecutionStatus;
  stage: ExecutionStage;
  startedAt: string;
  endedAt: string;
  inputPath: string;
  outputPath: string;
  errorMessage?: string;
}

/**
 * 递归获取目录下所有指定扩展名的文件
 */
async function getAllFilesByExt(dir: string, ext: string): Promise<string[]> {
  const files: string[] = [];

  async function scan(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.name.toLowerCase().endsWith(ext)) {
        files.push(fullPath);
      }
    }
  }

  try {
    await scan(dir);
  } catch {
    // 目录不存在或无法访问
  }

  return files;
}

export class CLIHandler {
  static async handleCommand(command: string, options: any) {
    const startedAt = new Date();
    let stage: ExecutionStage = 'input_validate';

    const { unifiedOptions, deprecations } = this._normalizeCliOptions(options || {});
    const jsonOutput = new JsonOutput({
      quiet: unifiedOptions.quiet || false,
      json: unifiedOptions.json || false,
    });

    if (unifiedOptions.noColor || process.env.NO_COLOR) {
      chalk.level = 0;
    }

    if (!jsonOutput.shouldSuppressOutput()) {
      this._printDeprecations(deprecations);
    }

    if (command === 'init') {
      try {
        await this._handleInit(unifiedOptions, jsonOutput);
        return;
      } catch (error) {
        const actionable = this._toActionableError(error);
        this._printActionableError(actionable, jsonOutput);
        process.exit(1);
      }
    }

    const normalizedCommand = this._toSupportedCommand(command);
    if (!normalizedCommand) {
      const actionable = this._toActionableError(new Error(`Unsupported command: ${command}`));
      this._printActionableError(actionable, jsonOutput);
      process.exit(1);
    }

    let latestReportPath = resolveLatestReportPath(normalizedCommand, process.cwd());
    let reportOutputPath = resolveDefaultOutputPath(normalizedCommand, process.cwd());
    let reportInputPath = unifiedOptions.input || '';

    try {
      const commandConfig = this._transformOptionsToConfig(unifiedOptions);
      const loaded = await ConfigLoader.loadConfigWithTrace(commandConfig);
      const config = loaded.effectiveConfig;

      const resolvedOutputPath = this._resolveOutputPath(normalizedCommand, unifiedOptions, config, loaded.sources);
      config.output = {
        ...config.output,
        path: resolvedOutputPath,
      };

      reportOutputPath = resolvedOutputPath;
      reportInputPath = unifiedOptions.input || config.input?.path || '';

      const progress = new ProgressIndicator({
        verbose: unifiedOptions.verbose || false,
        json: unifiedOptions.json || false,
        quiet: unifiedOptions.quiet || false,
      });

      if (unifiedOptions.showConfig) {
        this._printEffectiveConfig(config, loaded.sources, jsonOutput);
      }

      if (normalizedCommand === 'convert' && !unifiedOptions.noInput && await this._isFirstRun()) {
        await this._runSetupWizard(jsonOutput);
        return;
      }

      let report: StructuredExecutionReport | undefined;

      stage = 'execute';
      switch (normalizedCommand) {
        case 'convert':
          report = await this._handleConvertUnified(config, progress, unifiedOptions);
          break;
        case 'html': {
          const summary = await this._handleHtml(config, progress);
          report = this._buildReport('html', summary.total, summary.success, summary.failed, summary.duration, summary.failedFiles);
          break;
        }
        case 'merge': {
          const summary = await this._handleMerge(config, progress);
          report = this._buildReport(
            'merge',
            summary.total,
            summary.success,
            summary.failed,
            summary.duration,
            summary.failedOperations.map((item) => ({ file: item.path, error: item.error }))
          );
          break;
        }
        case 'extract': {
          report = await this._handleExtract(config, progress, unifiedOptions);
          break;
        }
      }

      stage = 'write_output';
      if (report) {
        this._printSuccessSummary(normalizedCommand, reportOutputPath, jsonOutput);
      }

      if (report && unifiedOptions.reportJson) {
        await this._writeStructuredReport(unifiedOptions.reportJson, report, jsonOutput);
      }

      stage = 'write_report';
      if (report) {
        const latestReport = this._buildLatestExecutionReport({
          command: normalizedCommand,
          status: 'success',
          stage: 'write_output',
          startedAt,
          endedAt: new Date(),
          inputPath: reportInputPath,
          outputPath: reportOutputPath,
        });

        try {
          await this._writeLatestReport(latestReportPath, latestReport);
        } catch (writeReportError) {
          if (!jsonOutput.isJsonMode()) {
            console.error(chalk.red(`write_report 失败: ${writeReportError instanceof Error ? writeReportError.message : String(writeReportError)}`));
          }
          process.exit(1);
        }
      }

      progress.complete();
    } catch (error) {
      if (error instanceof Error && /^Process exited with code \d+$/u.test(error.message)) {
        throw error;
      }

      if (stage !== 'write_report') {
        const failedReport = this._buildLatestExecutionReport({
          command: normalizedCommand,
          status: 'failed',
          stage,
          startedAt,
          endedAt: new Date(),
          inputPath: reportInputPath,
          outputPath: reportOutputPath,
          errorMessage: error instanceof Error ? error.message : String(error),
        });

        try {
          await this._writeLatestReport(latestReportPath, failedReport);
        } catch (writeReportError) {
          if (!jsonOutput.isJsonMode()) {
            console.error(chalk.red(`write_report 失败: ${writeReportError instanceof Error ? writeReportError.message : String(writeReportError)}`));
          }
        }
      }

      this._printFailureSummary(normalizedCommand, stage, latestReportPath, jsonOutput);
      const actionable = this._toActionableError(error);
      this._printActionableError(actionable, jsonOutput);
      process.exit(1);
    }
  }

  private static _normalizeCliOptions(options: Record<string, any>): {
    unifiedOptions: UnifiedCLIOptions;
    deprecations: DeprecationEntry[];
  } {
    const unified: UnifiedCLIOptions = {
      input: options.input,
      output: options.output,
      config: options.config,
      theme: options.theme,
      concurrent: options.concurrent,
      timeout: options.timeout,
      pageSize: options.pageSize,
      outputFormat: options.outFormat,
      dryRun: Boolean(options.dryRun),
      showConfig: Boolean(options.showConfig),
      reportJson: options.reportJson,
      verbose: Boolean(options.verbose),
      json: Boolean(options.json),
      quiet: Boolean(options.quiet),
      noColor: Boolean(options.noColor),
      noInput: Boolean(options.noInput),
      limit: Number.isFinite(Number(options.limit)) ? Number(options.limit) : 50,
    };

    const deprecations: DeprecationEntry[] = [];

    const hasFormatOption = Object.prototype.hasOwnProperty.call(options, 'format');
    const hasPageSizeOption = Object.prototype.hasOwnProperty.call(options, 'pageSize');
    const hasOutFormatOption = Object.prototype.hasOwnProperty.call(options, 'outFormat');

    if (hasFormatOption && options.format !== undefined) {
      if (hasOutFormatOption && !hasPageSizeOption) {
        unified.outputFormat = options.format;
        deprecations.push({
          legacy: '--format',
          replacement: '--out-format',
          note: 'extract 命令的 --format 将在 v4.0.0 移除',
        });
      } else {
        unified.pageSize = options.format;
        deprecations.push({
          legacy: '--format',
          replacement: '--page-size',
          note: 'convert 命令的 --format 将在 v4.0.0 移除',
        });
      }
    }

    if (process.env.NO_COLOR) {
      unified.noColor = true;
    }

    return { unifiedOptions: unified, deprecations };
  }

  private static _printDeprecations(items: DeprecationEntry[]): void {
    for (const item of items) {
      console.warn(
        chalk.yellow(
          `⚠ 参数 ${item.legacy} 已弃用，请改用 ${item.replacement}${item.note ? `（${item.note}）` : ''}`
        )
      );
    }
  }

  private static _transformOptionsToConfig(options: UnifiedCLIOptions): Partial<Mark2pdfConfig> {
    const config: Partial<Mark2pdfConfig> = {};

    if (options.input) {
      config.input = { path: options.input, extensions: ['.md'] };
    }

    if (options.output) {
      config.output = { path: options.output, createDirIfNotExist: true, maintainDirStructure: true };
    }

    const nextOptions: NonNullable<Partial<Mark2pdfConfig>['options']> = {
      concurrent: options.concurrent ?? 3,
      timeout: options.timeout ?? 30000,
      format: options.pageSize ?? 'A4',
      orientation: 'portrait',
      toc: false,
      overwrite: false,
    };

    if (options.theme) {
      nextOptions.theme = options.theme;
    }

    if (
      options.concurrent !== undefined ||
      options.timeout !== undefined ||
      options.pageSize !== undefined ||
      options.theme !== undefined
    ) {
      config.options = nextOptions;
    }

    return config;
  }

  private static async _isFirstRun(): Promise<boolean> {
    const userConfigPath = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.mark2pdf',
      'config.json'
    );
    return !(await this._fileExists(userConfigPath));
  }

  private static async _runSetupWizard(jsonOutput?: JsonOutput) {
    if (jsonOutput?.isJsonMode()) {
      throw new Error('JSON 模式下不支持交互式初始化，请使用 --no-input 或直接提供命令参数。');
    }

    console.log(chalk.blue('欢迎使用 mark2pdf！首次使用需要配置基本参数：\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputPath',
        message: '输入目录（文档文件所在目录）:',
        default: './public/md',
        validate: (input: string) =>
          input.trim() !== '' || '输入目录不能为空',
      },
      {
        type: 'checkbox',
        name: 'extensions',
        message: '支持的输入格式（空格选择）:',
        choices: [
          { name: 'Markdown (.md)', value: '.md', checked: true },
          { name: 'HTML (.html)', value: '.html' },
          { name: 'Word (.docx)', value: '.docx' },
          { name: 'PDF (.pdf)', value: '.pdf' },
        ],
      },
      {
        type: 'input',
        name: 'outputPath',
        message: '输出目录（文件保存目录）:',
        default: './dist/pdf',
        validate: (input: string) =>
          input.trim() !== '' || '输出目录不能为空',
      },
      {
        type: 'list',
        name: 'outputFormat',
        message: '默认输出格式:',
        choices: [
          { name: 'PDF - 适合打印和分发', value: 'pdf' },
          { name: 'TXT - 纯文本，适合 AI 处理', value: 'txt' },
          { name: 'MD - Markdown 格式', value: 'md' },
          { name: 'JSON - 结构化数据', value: 'json' },
        ],
        default: 'pdf',
      },
      {
        type: 'list',
        name: 'format',
        message: 'PDF 页面格式:',
        choices: ['A4', 'Letter', 'A3', 'A5'],
        default: 'A4',
        when: (ans: any) => ans.outputFormat === 'pdf',
      },
      {
        type: 'number',
        name: 'concurrent',
        message: '并发处理数（1-10）:',
        default: 3,
        validate: (value: number) =>
          value >= 1 && value <= 10 || '并发数必须在1-10之间',
      },
    ] as any);

    const config: Mark2pdfConfig = {
      input: {
        path: answers.inputPath,
        extensions: answers.extensions.length > 0 ? answers.extensions : ['.md'],
      },
      output: {
        path: answers.outputPath,
        createDirIfNotExist: true,
        maintainDirStructure: true,
        format: answers.outputFormat,
      },
      options: {
        concurrent: answers.concurrent,
        format: answers.format || 'A4',
        timeout: 30000,
        orientation: 'portrait',
        toc: false,
        overwrite: false,
      },
      features: {
        incremental: true,
        retry: 2,
        cache: true,
      },
    };

    const userConfigDir = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.mark2pdf'
    );
    await fs.mkdir(userConfigDir, { recursive: true });

    await fs.writeFile(
      path.join(userConfigDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    console.log(chalk.green('✓ 配置已保存到 ~/.mark2pdf/config.json'));
  }

  private static async _handleConvertUnified(
    config: Mark2pdfConfig,
    progress: ProgressIndicator,
    options: UnifiedCLIOptions
  ): Promise<StructuredExecutionReport> {
    let plan = await this._buildConvertExecutionPlan(config, options);

    const limit = options.limit ?? 50;
    const hasMore = limit > 0 && plan.items.length > limit;
    if (hasMore) {
      plan = {
        ...plan,
        items: plan.items.slice(0, limit),
      };
    }

    if (options.dryRun) {
      this._printDryRunPlan(plan, hasMore, options.json || false);
      return this._buildReport('convert', plan.items.length, 0, 0, 0, []);
    }

    const startedAt = Date.now();
    const failedDetails: Array<{ file: string; error: string }> = [];
    let success = 0;
    let failed = 0;

    const groups = {
      md: plan.items.filter((item) => item.action === 'convert-md').map((item) => item.inputPath),
      html: plan.items.filter((item) => item.action === 'convert-html').map((item) => item.inputPath),
      docx: plan.items.filter((item) => item.action === 'extract-docx').map((item) => item.inputPath),
      pdf: plan.items.filter((item) => item.action === 'extract-pdf').map((item) => item.inputPath),
    };

    if (groups.md.length > 0) {
      const converter = new ConverterService(
        {
          ...config,
          input: { ...config.input, path: options.input || config.input.path, extensions: ['.md'] },
          output: { ...config.output, path: options.output || config.output.path },
        },
        progress
      );
      const summary = await converter.convertFiles(groups.md);
      success += summary.success;
      failed += summary.failed;
      failedDetails.push(...summary.failedFiles);
    }

    if (groups.html.length > 0) {
      const htmlConverter = new HtmlConverterService(progress, {
        format: config.options?.format as 'A4' | 'A3' | 'A5' | 'Letter' || 'A4',
      });
      const summary = await htmlConverter.convertFiles(groups.html, config.input.path, config.output.path);
      success += summary.success;
      failed += summary.failed;
      failedDetails.push(...summary.failedFiles);
    }

    if (groups.docx.length > 0 || groups.pdf.length > 0) {
      const extractionReport = await this._runExtractionByPlan(plan, config, options);
      success += extractionReport.success;
      failed += extractionReport.failed;
      failedDetails.push(...extractionReport.failedDetails);
    }

    const skipped = plan.items.filter((item) => item.action === 'skip').length;
    const total = success + failed + skipped;

    return this._buildReport(
      'convert',
      total,
      success,
      failed,
      Date.now() - startedAt,
      failedDetails
    );
  }

  private static async _runExtractionByPlan(
    plan: ConvertExecutionPlan,
    config: Mark2pdfConfig,
    options: UnifiedCLIOptions
  ): Promise<StructuredExecutionReport> {
    const outputPath = options.output || config.output.path || './output';
    const outputFormat = options.outputFormat || 'txt';

    const extractor = new PdfExtractor({ format: outputFormat, outputDir: outputPath });
    const docxConverter = new DocxConverter({ format: outputFormat, outputDir: outputPath });

    let success = 0;
    let failed = 0;
    const failedDetails: Array<{ file: string; error: string }> = [];
    const startedAt = Date.now();

    for (const item of plan.items) {
      if (item.action === 'extract-pdf') {
        const result = await extractor.extract(item.inputPath, outputPath);
        if (result.success) {
          success++;
        } else {
          failed++;
          failedDetails.push({ file: item.inputPath, error: result.error || '未知错误' });
        }
      }

      if (item.action === 'extract-docx') {
        const result = await docxConverter.convert(item.inputPath, outputPath);
        if (result.success) {
          success++;
        } else {
          failed++;
          failedDetails.push({ file: item.inputPath, error: result.error || '未知错误' });
        }
      }
    }

    return this._buildReport(
      'extract',
      plan.items.filter((item) => item.action === 'extract-docx' || item.action === 'extract-pdf').length,
      success,
      failed,
      Date.now() - startedAt,
      failedDetails
    );
  }

  private static async _buildConvertExecutionPlan(
    config: Mark2pdfConfig,
    options: UnifiedCLIOptions
  ): Promise<ConvertExecutionPlan> {
    const inputRoot = options.input || config.input.path;
    const outputRoot = options.output || config.output.path;

    const stat = await fs.stat(inputRoot).catch(() => null);
    const candidates: string[] = [];

    if (stat?.isFile()) {
      candidates.push(inputRoot);
    } else {
      const extensionSet = ['.md', '.markdown', '.html', '.htm', '.docx', '.pdf'];
      for (const ext of extensionSet) {
        const files = await getAllFiles(inputRoot, ext) as string[];
        candidates.push(...files);
      }
    }

    const uniqCandidates = Array.from(new Set(candidates));

    const items = uniqCandidates.map((filePath) => {
      const type = detectInputType(filePath);
      const relativePath = stat?.isFile() ? path.basename(filePath) : path.relative(inputRoot, filePath);
      const baseName = relativePath.replace(/\.[^.]+$/, '');

      if (type === 'md') {
        return {
          inputPath: filePath,
          type,
          action: 'convert-md' as const,
          targetPath: path.join(outputRoot, `${baseName}.pdf`),
        };
      }

      if (type === 'html') {
        return {
          inputPath: filePath,
          type,
          action: 'convert-html' as const,
          targetPath: path.join(outputRoot, `${baseName}.pdf`),
        };
      }

      if (type === 'docx') {
        const ext = options.outputFormat || 'txt';
        return {
          inputPath: filePath,
          type,
          action: 'extract-docx' as const,
          targetPath: path.join(outputRoot, `${baseName}.${ext}`),
        };
      }

      if (type === 'pdf') {
        const ext = options.outputFormat || 'txt';
        return {
          inputPath: filePath,
          type,
          action: 'extract-pdf' as const,
          targetPath: path.join(outputRoot, `${baseName}.${ext}`),
        };
      }

      return {
        inputPath: filePath,
        type,
        action: 'skip' as const,
        reason: '不支持的输入类型',
      };
    });

    if (items.length === 0) {
      items.push({
        inputPath: inputRoot,
        type: 'unknown',
        action: 'skip',
        reason: '未发现可处理文件',
      });
    }

    return {
      inputRoot,
      outputRoot,
      items,
    };
  }

  private static _printDryRunPlan(
    plan: ConvertExecutionPlan,
    hasMore: boolean = false,
    isJsonMode: boolean = false
  ): void {
    if (isJsonMode) {
      const output = {
        dry_run: true,
        input: plan.inputRoot,
        output: plan.outputRoot,
        total_files: plan.items.length,
        has_more: hasMore,
        items: plan.items.map((item) => ({
          action: item.action,
          input: item.inputPath,
          output: item.targetPath,
          reason: item.reason,
        })),
      };
      console.log(JSON.stringify(output));
      return;
    }

    console.log(chalk.cyan('\n🧪 Dry-run 执行计划（无副作用）'));
    console.log(chalk.gray('='.repeat(60)));
    console.log(`输入: ${plan.inputRoot}`);
    console.log(`输出: ${plan.outputRoot}`);

    for (const item of plan.items) {
      if (item.action === 'skip') {
        console.log(`- [SKIP] ${item.inputPath} (${item.reason || '未知原因'})`);
      } else {
        console.log(`- [${item.action}] ${item.inputPath} -> ${item.targetPath}`);
      }
    }

    if (hasMore) {
      console.log(chalk.yellow('... 已按 --limit 截断，仍有更多文件未展示'));
    }

    console.log(chalk.gray('='.repeat(60)));
    console.log(chalk.green('Dry-run 完成：未创建任何文件，未执行实际转换。'));
  }

  private static _printEffectiveConfig(
    config: Mark2pdfConfig,
    sources: Record<string, ConfigSource>,
    jsonOutput: JsonOutput
  ): void {
    const lines: string[] = [];
    this._flattenConfig(config, '', lines, sources);

    if (jsonOutput.isJsonMode()) {
      console.log(JSON.stringify({
        config,
        sources,
      }));
      return;
    }

    console.log(chalk.cyan('\n🧭 生效配置（含来源）'));
    console.log(chalk.gray('='.repeat(60)));
    lines.forEach((line) => console.log(line));
    console.log(chalk.gray('='.repeat(60)));
  }

  private static _flattenConfig(
    value: unknown,
    prefix: string,
    lines: string[],
    sources: Record<string, ConfigSource>
  ): void {
    if (Array.isArray(value)) {
      const source = sources[prefix] || 'default';
      lines.push(`${prefix}: ${JSON.stringify(value)}  ${chalk.gray(`[${source}]`)}`);
      return;
    }

    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const path = prefix ? `${prefix}.${key}` : key;
        this._flattenConfig(child, path, lines, sources);
      }
      return;
    }

    if (prefix) {
      const source = sources[prefix] || 'default';
      const maskedValue = this._isSensitivePath(prefix) ? '***' : String(value);
      lines.push(`${prefix}: ${maskedValue}  ${chalk.gray(`[${source}]`)}`);
    }
  }

  private static _isSensitivePath(pathKey: string): boolean {
    return ['token', 'password', 'secret', 'key'].some((fragment) =>
      pathKey.toLowerCase().includes(fragment)
    );
  }

  private static async _handleHtml(
    config: Mark2pdfConfig,
    progress: ProgressIndicator
  ) {
    const htmlConverter = new HtmlConverterService(progress, {
      format: config.options?.format as 'A4' | 'A3' | 'A5' | 'Letter' || 'A4'
    });
    return htmlConverter.convertAll(config.input.path, config.output.path);
  }

  private static async _handleMerge(
    config: Mark2pdfConfig,
    progress: ProgressIndicator
  ) {
    const merger = new MergerService(config, progress);
    return merger.mergeAll();
  }

  private static async _handleExtract(
    config: Mark2pdfConfig,
    progress: ProgressIndicator,
    options: UnifiedCLIOptions
  ): Promise<StructuredExecutionReport> {
    const inputPath = options.input || config.input?.path || './input';
    const outputPath = options.output || config.output?.path || './output';
    const format = (options.outputFormat || 'txt') as OutputFormat;
    const startedAt = Date.now();

    progress.info(`正在从 ${inputPath} 提取文本...`);

    const stat = await fs.stat(inputPath).catch(() => null);

    let files: string[] = [];

    if (stat?.isFile()) {
      files = [inputPath];
    } else {
      const extensions = ['.pdf', '.docx'];
      for (const ext of extensions) {
        const found = await getAllFilesByExt(inputPath, ext);
        files = files.concat(found);
      }
    }

    if (files.length === 0) {
      progress.warn('未找到任何可提取的文件');
      return this._buildReport('extract', 0, 0, 0, 0, []);
    }

    const limit = options.limit ?? 50;
    const hasMore = limit > 0 && files.length > limit;
    const limitedFiles = hasMore ? files.slice(0, limit) : files;

    progress.info(`找到 ${limitedFiles.length} 个文件待处理`);

    if (options.dryRun) {
      const plan: ConvertExecutionPlan = {
        inputRoot: inputPath,
        outputRoot: outputPath,
        items: limitedFiles.map((file) => {
          const type = detectInputType(file);
          const ext = format;
          return {
            inputPath: file,
            type,
            action: type === 'pdf' ? 'extract-pdf' : type === 'docx' ? 'extract-docx' : 'skip',
            targetPath: path.join(outputPath, `${path.basename(file, path.extname(file))}.${ext}`),
            reason: type === 'pdf' || type === 'docx' ? undefined : '不支持的输入类型',
          };
        }),
      };
      this._printDryRunPlan(plan, hasMore, options.json || false);
      return this._buildReport('extract', limitedFiles.length, 0, 0, 0, []);
    }

    await fs.mkdir(outputPath, { recursive: true });

    const results: Array<{ success: boolean; file: string; error?: string }> = [];

    for (const file of limitedFiles) {
      const fileType = detectInputType(file);

      if (fileType === 'pdf') {
        const extractor = new PdfExtractor({ format, outputDir: outputPath });
        const result = await extractor.extract(file);
        results.push({ success: result.success, file, error: result.error });

        if (result.success) {
          progress.info(`✓ ${path.basename(file)} → ${result.output}`);
        } else {
          progress.error(`✗ ${path.basename(file)}: ${result.error}`);
        }
      } else if (fileType === 'docx') {
        const converter = new DocxConverter({ format, outputDir: outputPath });
        const result = await converter.convert(file);
        results.push({ success: result.success, file, error: result.error });

        if (result.success) {
          progress.info(`✓ ${path.basename(file)} → ${result.output}`);
        } else {
          progress.error(`✗ ${path.basename(file)}: ${result.error}`);
        }
      } else {
        const reason = `跳过不支持的文件类型: ${file}`;
        progress.warn(reason);
        results.push({ success: false, file, error: reason });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return this._buildReport(
      'extract',
      limitedFiles.length,
      successCount,
      failCount,
      Date.now() - startedAt,
      results.filter((r) => !r.success).map((r) => ({ file: r.file, error: r.error || '未知错误' }))
    );
  }

  private static async _handleInit(options: UnifiedCLIOptions, jsonOutput: JsonOutput) {
    void options;

    await this._runSetupWizard(jsonOutput);
  }

  private static async _writeStructuredReport(
    reportPath: string,
    report: StructuredExecutionReport,
    jsonOutput: JsonOutput
  ): Promise<void> {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    if (!jsonOutput.shouldSuppressOutput()) {
      console.log(chalk.green(`✅ 结构化报告已输出: ${reportPath}`));
    }
  }

  private static _buildReport(
    command: string,
    total: number,
    success: number,
    failed: number,
    durationMs: number,
    failedDetails: Array<{ file: string; error: string }>
  ): StructuredExecutionReport {
    return {
      command,
      total,
      success,
      failed,
      durationMs,
      failedDetails,
    };
  }

  private static _toSupportedCommand(command: string): SupportedCommand | undefined {
    if (command === 'convert' || command === 'html' || command === 'merge' || command === 'extract') {
      return command;
    }

    return undefined;
  }

  private static _resolveOutputPath(
    command: SupportedCommand,
    options: UnifiedCLIOptions,
    config: Mark2pdfConfig,
    sources: Record<string, ConfigSource>
  ): string {
    const cliOutput = options.output;
    const configOutput = config.output?.path;
    const outputSource = sources['output.path'];

    if (!cliOutput && outputSource === 'default') {
      return resolveDefaultOutputPath(command, process.cwd());
    }

    if (!cliOutput && configOutput) {
      return configOutput;
    }

    return resolveEffectiveOutputPath(command, cliOutput, process.cwd());
  }

  private static _buildLatestExecutionReport(input: {
    command: SupportedCommand;
    status: ExecutionStatus;
    stage: ExecutionStage;
    startedAt: Date;
    endedAt: Date;
    inputPath: string;
    outputPath: string;
    errorMessage?: string;
  }): LatestExecutionReport {
    const report: LatestExecutionReport = {
      runId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      command: input.command,
      status: input.status,
      stage: input.stage,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt.toISOString(),
      inputPath: input.inputPath,
      outputPath: input.outputPath,
    };

    if (input.errorMessage) {
      report.errorMessage = input.errorMessage;
    }

    return report;
  }

  private static async _writeLatestReport(reportPath: string, report: LatestExecutionReport): Promise<void> {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  }

  private static _printSuccessSummary(
    command: SupportedCommand,
    outputPath: string,
    jsonOutput: JsonOutput
  ): void {
    if (jsonOutput.isJsonMode()) {
      console.log(JSON.stringify({ command, output: outputPath, status: 'success' }));
      return;
    }

    if (!jsonOutput.shouldSuppressOutput()) {
      console.log(chalk.green(`✅ ${command} 完成，输出目录：${outputPath}`));
    }
  }

  private static _printFailureSummary(
    command: SupportedCommand,
    stage: ExecutionStage,
    latestReportPath: string,
    jsonOutput: JsonOutput
  ): void {
    if (jsonOutput.isJsonMode()) {
      return;
    }

    console.error(chalk.red(`❌ ${command} 失败（阶段：${stage}），详情：${latestReportPath}`));
  }

  private static _toActionableError(error: unknown): ActionableError {
    const message = error instanceof Error ? error.message : String(error);
    const lowered = message.toLowerCase();

    if (lowered.includes('invalid') || lowered.includes('参数') || lowered.includes('option')) {
      return {
        category: 'argument',
        summary: message,
        action: 'mark2pdf --help',
      };
    }

    if (lowered.includes('path') || lowered.includes('enoent') || lowered.includes('不存在')) {
      return {
        category: 'path',
        summary: message,
        action: 'mark2pdf convert --show-config',
      };
    }

    if (lowered.includes('eacces') || lowered.includes('permission') || lowered.includes('权限')) {
      return {
        category: 'permission',
        summary: message,
        action: 'mark2pdf convert -o ./output',
      };
    }

    return {
      category: 'runtime',
      summary: message,
      action: 'mark2pdf --verbose convert --dry-run',
    };
  }

  private static _printActionableError(error: ActionableError, jsonOutput: JsonOutput): void {
    const formatted = jsonOutput.formatError({
      category: error.category,
      summary: error.summary,
      action: error.action,
    });

    if (jsonOutput.isJsonMode() && typeof formatted === 'object') {
      console.error(JSON.stringify(formatted));
      return;
    }

    const fallback = ErrorFormatter.toStructuredError(
      new Error(`${error.category}: ${error.summary}`),
      false
    );

    console.error(typeof formatted === 'string' ? formatted : fallback);
  }

  private static async _fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
