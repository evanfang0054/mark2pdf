import inquirer from 'inquirer';
import chalk from 'chalk';
import { Mark2pdfConfig } from '../config/schema';
import { ConfigMigrator } from '../config/migrator';

/**
 * 向导配置接口
 */
interface WizardConfig {
  inputPath: string;
  outputPath: string;
  concurrent: number;
  format: string;
  orientation: string;
  useToc: boolean;
  useIncremental: boolean;
  useCache: boolean;
  retryCount: number;
}

/**
 * 交互式配置向导
 */
export class SetupWizard {
  /**
   * 启动配置向导
   * @returns {Promise<Mark2pdfConfig>} 生成的配置
   */
  static async start(): Promise<Mark2pdfConfig> {
    console.log(chalk.blue('🧙‍♂️ 欢迎使用 mark2pdf 配置向导！'));
    console.log(chalk.gray('本向导将帮助您创建 mark2pdf 的配置文件。'));
    console.log('');

    const config = await this.promptBasicConfig();
    const advanced = await this.promptAdvancedConfig();

    // 合并配置
    const mergedConfig = { ...config, ...advanced };

    const finalConfig: Mark2pdfConfig = {
      input: {
        path: mergedConfig.inputPath || './public/md',
        extensions: ['.md'],
      },
      output: {
        path: mergedConfig.outputPath || './dist/pdf',
        createDirIfNotExist: true,
        maintainDirStructure: true,
      },
      options: {
        concurrent: mergedConfig.concurrent || 3,
        timeout: 30000,
        format: (mergedConfig.format || 'A4') as any,
        orientation: (mergedConfig.orientation || 'portrait') as any,
        toc: mergedConfig.useToc || false,
        overwrite: false,
      },
      features: {
        incremental: mergedConfig.useIncremental || true,
        retry: mergedConfig.retryCount || 2,
        cache: mergedConfig.useCache || true,
      },
    };

    // 显示配置摘要
    await this.showSummary(finalConfig);

    // 确认保存
    const { saveConfig } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveConfig',
        message: '是否保存配置文件？',
        default: true,
      },
    ]);

    if (saveConfig) {
      await this.saveConfiguration(finalConfig);
    }

    return finalConfig;
  }

  /**
   * 询问基本配置
   * @private
   */
  private static async promptBasicConfig(): Promise<Partial<WizardConfig>> {
    console.log(chalk.yellow('📁 基本配置'));
    console.log(chalk.gray('配置输入输出路径和基本转换选项。'));
    console.log('');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputPath',
        message: 'Markdown 文件输入目录:',
        default: './public/md',
        validate: (input: string) => {
          if (!input.trim()) {
            return '请输入输入目录路径';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'outputPath',
        message: 'PDF 文件输出目录:',
        default: './dist/pdf',
        validate: (input: string) => {
          if (!input.trim()) {
            return '请输入输出目录路径';
          }
          return true;
        },
      },
      {
        type: 'number',
        name: 'concurrent',
        message: '并发转换数量:',
        default: 3,
        validate: (input: number) => {
          if (input < 1 || input > 10) {
            return '并发数量必须在 1-10 之间';
          }
          return true;
        },
      },
      {
        type: 'list',
        name: 'format',
        message: 'PDF 页面格式:',
        choices: ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid'],
        default: 'A4',
      },
      {
        type: 'list',
        name: 'orientation',
        message: '页面方向:',
        choices: ['portrait', 'landscape'],
        default: 'portrait',
      },
      {
        type: 'confirm',
        name: 'useToc',
        message: '是否生成目录?',
        default: false,
      },
    ] as any);

    return answers;
  }

  /**
   * 询问高级配置
   * @private
   */
  private static async promptAdvancedConfig(): Promise<Partial<WizardConfig>> {
    console.log('');
    console.log(chalk.yellow('⚙️ 高级配置'));
    console.log(chalk.gray('配置性能优化和错误处理选项。'));
    console.log('');

    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useIncremental',
        message: '启用增量转换（只转换修改过的文件）?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'useCache',
        message: '启用转换缓存?',
        default: true,
      },
      {
        type: 'number',
        name: 'retryCount',
        message: '失败重试次数:',
        default: 2,
        validate: (input: number) => {
          if (input < 0 || input > 5) {
            return '重试次数必须在 0-5 之间';
          }
          return true;
        },
      },
    ] as any);

    return answers;
  }

  /**
   * 显示配置摘要
   * @private
   * @param {Mark2pdfConfig} config 配置对象
   */
  private static async showSummary(config: Mark2pdfConfig): Promise<void> {
    console.log('');
    console.log(chalk.blue('📋 配置摘要'));
    console.log(chalk.gray('以下是根据您的选择生成的配置：'));
    console.log('');

    console.log(chalk.white('输入设置:'));
    console.log(`  路径: ${chalk.green(config.input.path)}`);
    console.log(`  扩展名: ${chalk.green(config.input.extensions.join(', '))}`);
    console.log('');

    console.log(chalk.white('输出设置:'));
    console.log(`  路径: ${chalk.green(config.output.path)}`);
    console.log(`  自动创建目录: ${chalk.green(config.output.createDirIfNotExist ? '是' : '否')}`);
    console.log(`  保持目录结构: ${chalk.green(config.output.maintainDirStructure ? '是' : '否')}`);
    console.log('');

    console.log(chalk.white('转换选项:'));
    console.log(`  并发数量: ${chalk.green(config.options.concurrent)}`);
    console.log(`  页面格式: ${chalk.green(config.options.format)}`);
    console.log(`  页面方向: ${chalk.green(config.options.orientation)}`);
    console.log(`  生成目录: ${chalk.green(config.options.toc ? '是' : '否')}`);
    console.log('');

    console.log(chalk.white('功能特性:'));
    console.log(`  增量转换: ${chalk.green(config.features.incremental ? '是' : '否')}`);
    console.log(`  转换缓存: ${chalk.green(config.features.cache ? '是' : '否')}`);
    console.log(`  重试次数: ${chalk.green(config.features.retry)}`);
    console.log('');
  }

  /**
   * 保存配置文件
   * @private
   * @param {Mark2pdfConfig} config 配置对象
   */
  private static async saveConfiguration(config: Mark2pdfConfig): Promise<void> {
    const { configPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'configPath',
        message: '配置文件保存路径:',
        default: './config.json',
        validate: (input: string) => {
          if (!input.trim()) {
            return '请输入配置文件路径';
          }
          if (!input.endsWith('.json')) {
            return '配置文件必须是 JSON 格式';
          }
          return true;
        },
      },
    ]);

    try {
      await ConfigMigrator.generateTemplate(configPath, config);
      console.log(chalk.green(`✅ 配置文件已保存至: ${configPath}`));
    } catch (error) {
      console.error(chalk.red(`❌ 保存配置文件失败: ${error}`));
      throw error;
    }
  }

  /**
   * 检查现有配置
   * @returns {Promise<boolean>} 是否存在现有配置
   */
  static async checkExistingConfig(): Promise<boolean> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const configFiles = [
      'config.json',
      'mark2pdf.config.json',
      'merge.config.json'
    ];

    for (const configFile of configFiles) {
      try {
        await fs.access(path.join(process.cwd(), configFile));
        return true;
      } catch {
        // 文件不存在，继续检查下一个
      }
    }

    return false;
  }

  /**
   * 运行迁移向导
   * @returns {Promise<void>}
   */
  static async runMigration(): Promise<void> {
    console.log(chalk.blue('🔄 配置迁移向导'));
    console.log(chalk.gray('本向导将帮助您迁移现有的配置文件到新格式。'));
    console.log('');

    const hasExistingConfig = await this.checkExistingConfig();
    
    if (!hasExistingConfig) {
      console.log(chalk.yellow('⚠️ 未找到现有配置文件'));
      console.log(chalk.gray('如果您有旧版本的配置文件，请确保它位于当前目录中。'));
      return;
    }

    const { migrateAll } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'migrateAll',
        message: '是否迁移所有找到的配置文件?',
        default: true,
      },
    ]);

    try {
      if (migrateAll) {
        const result = await ConfigMigrator.migrateAllConfigs();
        
        console.log('');
        console.log(chalk.blue('📊 迁移结果'));
        console.log(chalk.green(`✅ 成功迁移 ${result.migrated.length} 个文件`));
        
        if (result.failed.length > 0) {
          console.log(chalk.red(`❌ 迁移失败 ${result.failed.length} 个文件`));
          result.failed.forEach(file => {
            console.log(chalk.gray(`   - ${file}`));
          });
        }
      } else {
        // 迁移单个文件
        const { configFile } = await inquirer.prompt([
          {
            type: 'list',
            name: 'configFile',
            message: '选择要迁移的配置文件:',
            choices: [
              'config.json',
              'mark2pdf.config.json',
              'merge.config.json'
            ],
          },
        ]);

        await ConfigMigrator.migrateConfig(configFile);
        console.log(chalk.green(`✅ 配置文件 ${configFile} 迁移完成`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ 迁移失败: ${error}`));
      throw error;
    }
  }
}