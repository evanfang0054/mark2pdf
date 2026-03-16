import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Mark2pdfConfig, OutputFormat } from '../config/schema';
import { ConfigLoader } from '../config/loader';
import { ProgressIndicator } from '../utils/progress';
import { ConverterService } from '../services/converter';
import { MergerService } from '../services/merger';
import { HtmlConverterService } from '../services/htmlConverter';
import { PdfExtractor } from '../core/PdfExtractor';
import { DocxConverter } from '../core/DocxConverter';
import { detectInputType } from '../utils/inputDetector';

/**
 * 递归获取目录下所有指定扩展名的文件
 */
async function getAllFiles(dir: string, ext: string): Promise<string[]> {
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
    try {
      // 转换命令行选项为配置格式
      const commandConfig = this._transformOptionsToConfig(options);

      // 加载配置
      const config = await ConfigLoader.loadConfig(commandConfig);

      // 检查是否首次运行（无配置文件）
      if (command === 'convert' && await this._isFirstRun()) {
        await this._runSetupWizard();
        return;
      }

      // 创建进度显示
      const progress = new ProgressIndicator({ verbose: options.verbose || false });

      // 执行对应命令
      switch (command) {
        case 'convert':
          await this._handleConvert(config, progress);
          break;
        case 'html':
          await this._handleHtml(config, progress);
          break;
        case 'merge':
          await this._handleMerge(config, progress);
          break;
        case 'extract':
          await this._handleExtract(config, progress, options);
          break;
        case 'init':
          await this._handleInit(options);
          break;
      }

      progress.complete();
    } catch (error) {
      console.error(chalk.red('错误:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  private static _transformOptionsToConfig(options: any): Partial<Mark2pdfConfig> {
    const config: Partial<Mark2pdfConfig> = {};

    if (options.input) {
      config.input = { path: options.input, extensions: ['.md'] };
    }
    
    if (options.output) {
      config.output = { path: options.output, createDirIfNotExist: true, maintainDirStructure: true };
    }

    if (options.concurrent) {
      config.options = { 
        concurrent: parseInt(options.concurrent),
        timeout: 30000,
        format: 'A4',
        orientation: 'portrait',
        toc: false,
        overwrite: false
      };
    }

    if (options.timeout) {
      config.options = { 
        ...config.options, 
        timeout: parseInt(options.timeout),
        concurrent: config.options?.concurrent || 3,
        format: config.options?.format || 'A4',
        orientation: config.options?.orientation || 'portrait',
        toc: config.options?.toc || false,
        overwrite: config.options?.overwrite || false
      };
    }

    if (options.format) {
      config.options = { 
        ...config.options, 
        format: options.format,
        concurrent: config.options?.concurrent || 3,
        timeout: config.options?.timeout || 30000,
        orientation: config.options?.orientation || 'portrait',
        toc: config.options?.toc || false,
        overwrite: config.options?.overwrite || false
      };
    }

    if (options.theme) {
      config.options = { 
        ...config.options, 
        theme: options.theme,
        concurrent: config.options?.concurrent || 3,
        timeout: config.options?.timeout || 30000,
        format: config.options?.format || 'A4',
        orientation: config.options?.orientation || 'portrait',
        toc: config.options?.toc || false,
        overwrite: config.options?.overwrite || false
      };
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

    // 生成配置文件
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

  private static async _handleConvert(
    config: Mark2pdfConfig,
    progress: ProgressIndicator
  ) {
    const converter = new ConverterService(config, progress);
    await converter.convertAll();
  }

  private static async _handleHtml(
    config: Mark2pdfConfig,
    progress: ProgressIndicator
  ) {
    const htmlConverter = new HtmlConverterService(progress, {
      format: config.options?.format as 'A4' | 'A3' | 'A5' | 'Letter' || 'A4'
    });
    await htmlConverter.convertAll(config.input.path, config.output.path);
  }

  private static async _handleMerge(
    config: Mark2pdfConfig,
    progress: ProgressIndicator
  ) {
    const merger = new MergerService(config, progress);
    await merger.mergeAll();
  }

  private static async _handleExtract(
    config: Mark2pdfConfig,
    progress: ProgressIndicator,
    options: any
  ) {
    const inputPath = options.input || config.input?.path || './input';
    const outputPath = options.output || config.output?.path || './output';
    const format = (options.format || 'txt') as OutputFormat;

    progress.info(`正在从 ${inputPath} 提取文本...`);

    // 检查是文件还是目录
    const stat = await fs.stat(inputPath).catch(() => null);

    let files: string[] = [];

    if (stat?.isFile()) {
      // 单文件
      files = [inputPath];
    } else {
      // 目录，扫描所有支持的文件
      const extensions = ['.pdf', '.docx'];
      for (const ext of extensions) {
        const found = await getAllFiles(inputPath, ext);
        files = files.concat(found);
      }
    }

    if (files.length === 0) {
      progress.warn('未找到任何可提取的文件');
      return;
    }

    progress.info(`找到 ${files.length} 个文件待处理`);

    // 确保输出目录存在
    await fs.mkdir(outputPath, { recursive: true });

    const results = [];

    for (const file of files) {
      const fileType = detectInputType(file);

      if (fileType === 'pdf') {
        const extractor = new PdfExtractor({ format, outputDir: outputPath });
        const result = await extractor.extract(file);
        results.push(result);

        if (result.success) {
          progress.info(`✓ ${path.basename(file)} → ${result.output}`);
        } else {
          progress.error(`✗ ${path.basename(file)}: ${result.error}`);
        }
      } else if (fileType === 'docx') {
        const converter = new DocxConverter({ format, outputDir: outputPath });
        const result = await converter.convert(file);
        results.push(result);

        if (result.success) {
          progress.info(`✓ ${path.basename(file)} → ${result.output}`);
        } else {
          progress.error(`✗ ${path.basename(file)}: ${result.error}`);
        }
      } else {
        progress.warn(`跳过不支持的文件类型: ${file}`);
      }
    }

    // 打印摘要
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log('');
    console.log(chalk.gray('═'.repeat(50)));
    console.log(chalk.bold.cyan('📋 提取报告'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(`  总计: ${chalk.white(files.length.toString())} 个文件`);
    console.log(`  成功: ${chalk.green(successCount.toString())} 个`);
    console.log(`  失败: ${failCount > 0 ? chalk.red(failCount.toString()) : chalk.gray('0')} 个`);
    console.log(chalk.gray('═'.repeat(50)));
  }

  private static async _handleInit(options: any) {
    void options; // 忽略未使用的参数
    const configPath = options.global 
      ? path.join(process.env.HOME || process.env.USERPROFILE || '', '.mark2pdf', 'config.json')
      : './mark2pdf.config.json';
    
    void configPath; // 忽略未使用的变量

    await this._runSetupWizard();
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
