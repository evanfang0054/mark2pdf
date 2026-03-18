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
    const startedAt = Date.now();

    try {
      const { unifiedOptions, deprecations } = this._normalizeCliOptions(options || {});
      this._printDeprecations(deprecations);

      const commandConfig = this._transformOptionsToConfig(unifiedOptions);
      const loaded = await ConfigLoader.loadConfigWithTrace(commandConfig);
      const config = loaded.effectiveConfig;

      const progress = new ProgressIndicator({ verbose: unifiedOptions.verbose || false });

      if (unifiedOptions.showConfig) {
        this._printEffectiveConfig(config, loaded.sources);
      }

      if (command === 'convert' && await this._isFirstRun()) {
        await this._runSetupWizard();
        return;
      }

      let report: StructuredExecutionReport | undefined;

      switch (command) {
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
        case 'init':
          await this._handleInit(unifiedOptions);
          break;
      }

      if (report) {
        this._printExecutionSummary(report);
      }

      if (report && unifiedOptions.reportJson) {
        await this._writeStructuredReport(unifiedOptions.reportJson, report);
      }

      if (command !== 'init') {
        progress.complete();
      }
    } catch (error) {
      const actionable = this._toActionableError(error);
      this._printActionableError(actionable);
      process.exit(1);
    } finally {
      void startedAt;
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
    };

    const deprecations: DeprecationEntry[] = [];

    if (options.format && !unified.pageSize) {
      unified.pageSize = options.format;
      deprecations.push({ legacy: '--format', replacement: '--page-size' });
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

  private static async _runSetupWizard() {
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
    const plan = await this._buildConvertExecutionPlan(config, options);

    if (options.dryRun) {
      this._printDryRunPlan(plan);
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
      const summary = await converter.convertAll();
      success += summary.success;
      failed += summary.failed;
      failedDetails.push(...summary.failedFiles);
    }

    if (groups.html.length > 0) {
      const htmlConverter = new HtmlConverterService(progress, {
        format: config.options?.format as 'A4' | 'A3' | 'A5' | 'Letter' || 'A4',
      });
      const summary = await htmlConverter.convertAll(config.input.path, config.output.path);
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

  private static _printDryRunPlan(plan: ConvertExecutionPlan): void {
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

    console.log(chalk.gray('='.repeat(60)));
    console.log(chalk.green('Dry-run 完成：未创建任何文件，未执行实际转换。'));
  }

  private static _printEffectiveConfig(config: Mark2pdfConfig, sources: Record<string, ConfigSource>): void {
    const lines: string[] = [];
    this._flattenConfig(config, '', lines, sources);

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

    progress.info(`找到 ${files.length} 个文件待处理`);

    if (options.dryRun) {
      const plan: ConvertExecutionPlan = {
        inputRoot: inputPath,
        outputRoot: outputPath,
        items: files.map((file) => {
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
      this._printDryRunPlan(plan);
      return this._buildReport('extract', files.length, 0, 0, 0, []);
    }

    await fs.mkdir(outputPath, { recursive: true });

    const results: Array<{ success: boolean; file: string; error?: string }> = [];

    for (const file of files) {
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
      files.length,
      successCount,
      failCount,
      Date.now() - startedAt,
      results.filter((r) => !r.success).map((r) => ({ file: r.file, error: r.error || '未知错误' }))
    );
  }

  private static async _handleInit(options: UnifiedCLIOptions) {
    void options;

    await this._runSetupWizard();
  }

  private static async _writeStructuredReport(reportPath: string, report: StructuredExecutionReport): Promise<void> {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(chalk.green(`✅ 结构化报告已输出: ${reportPath}`));
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

  private static _printExecutionSummary(report: StructuredExecutionReport): void {
    console.log('');
    console.log(chalk.gray('═'.repeat(50)));
    console.log(chalk.bold.cyan(`📋 执行摘要 (${report.command})`));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(`  总计: ${chalk.white(report.total.toString())} 项`);
    console.log(`  成功: ${chalk.green(report.success.toString())} 项`);
    console.log(`  失败: ${report.failed > 0 ? chalk.red(report.failed.toString()) : chalk.gray('0')} 项`);
    console.log(`  耗时: ${chalk.white(`${report.durationMs}ms`)}`);

    if (report.failedDetails.length > 0) {
      console.log(chalk.yellow('  失败明细:'));
      for (const item of report.failedDetails.slice(0, 5)) {
        console.log(chalk.yellow(`    - ${item.file}: ${item.error}`));
      }
      if (report.failedDetails.length > 5) {
        console.log(chalk.yellow(`    ... 其余 ${report.failedDetails.length - 5} 项请查看 JSON 报告`));
      }
    }

    console.log(chalk.gray('═'.repeat(50)));
  }

  private static _toActionableError(error: unknown): ActionableError {
    const message = error instanceof Error ? error.message : String(error);
    const lowered = message.toLowerCase();

    if (lowered.includes('invalid') || lowered.includes('参数') || lowered.includes('option')) {
      return {
        category: 'argument',
        summary: message,
        action: '请检查命令参数，使用 --help 查看示例。',
      };
    }

    if (lowered.includes('path') || lowered.includes('enoent') || lowered.includes('不存在')) {
      return {
        category: 'path',
        summary: message,
        action: '请确认输入/输出路径存在且可访问。',
      };
    }

    if (lowered.includes('eacces') || lowered.includes('permission') || lowered.includes('权限')) {
      return {
        category: 'permission',
        summary: message,
        action: '请检查目录权限，必要时调整写入目录或权限设置。',
      };
    }

    return {
      category: 'runtime',
      summary: message,
      action: '请使用 --verbose 复现并检查详细日志。',
    };
  }

  private static _printActionableError(error: ActionableError): void {
    console.error(chalk.red('\n[CLI_ERROR]'));
    console.error(`类别: ${error.category}`);
    console.error(`摘要: ${error.summary}`);
    console.error(`建议: ${error.action}`);
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
