import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Mark2pdfConfig } from '../config/schema';
import { ConfigLoader } from '../config/loader';
import { ProgressIndicator } from '../utils/progress';
import { ConverterService } from '../services/converter';
import { MergerService } from '../services/merger';

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
        message: '输入目录（Markdown 文件所在目录）:',
        default: './public/md',
        validate: (input: string) =>
          input.trim() !== '' || '输入目录不能为空',
      },
      {
        type: 'input',
        name: 'outputPath',
        message: '输出目录（PDF 文件保存目录）:',
        default: './dist/pdf',
        validate: (input: string) =>
          input.trim() !== '' || '输出目录不能为空',
      },
      {
        type: 'list',
        name: 'format',
        message: '页面格式:',
        choices: ['A4', 'Letter', 'A3', 'A5'],
        default: 'A4',
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
        extensions: ['.md'],
      },
      output: { 
        path: answers.outputPath,
        createDirIfNotExist: true,
        maintainDirStructure: true,
      },
      options: {
        concurrent: answers.concurrent,
        format: answers.format as any,
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
    _config: Mark2pdfConfig,
    _progress: ProgressIndicator
  ) {
    // TODO: 实现 HTML 转换逻辑
    console.log(chalk.yellow('HTML 转换功能正在开发中...'));
  }

  private static async _handleMerge(
    config: Mark2pdfConfig,
    progress: ProgressIndicator
  ) {
    const merger = new MergerService(config, progress);
    await merger.mergeAll();
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
