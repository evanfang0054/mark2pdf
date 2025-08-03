import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { Mark2pdfConfig, configSchema } from '../config/schema';
import { logger } from '../../src/utils/logger';

/**
 * 旧配置格式接口
 */
interface LegacyConfig {
  input?: {
    path?: string;
    extensions?: string[];
  };
  output?: {
    path?: string;
    createDirIfNotExist?: boolean;
    maintainDirStructure?: boolean;
  };
  options?: {
    concurrent?: number;
    timeout?: number;
    format?: string;
    orientation?: string;
    toc?: boolean;
    cssPath?: string;
  };
  features?: {
    incremental?: boolean;
    retry?: number;
    cache?: boolean;
  };
}

/**
 * 配置迁移工具
 * 负责将旧格式配置迁移到新格式
 */
export class ConfigMigrator {
  /**
   * 迁移配置文件
   * @param {string} configPath 配置文件路径
   * @param {boolean} [backup=true] 是否创建备份
   * @returns {Promise<Mark2pdfConfig>} 迁移后的配置
   */
  static async migrateConfig(configPath: string, backup: boolean = true): Promise<Mark2pdfConfig> {
    try {
      logger.info(`开始迁移配置文件: ${configPath}`);

      // 读取旧配置
      const content = await fs.readFile(configPath, 'utf-8');
      const legacyConfig: LegacyConfig = JSON.parse(content);

      // 创建备份
      if (backup) {
        const backupPath = configPath + '.backup.' + Date.now();
        await fs.writeFile(backupPath, content);
        logger.info(`已创建备份文件: ${backupPath}`);
      }

      // 迁移配置
      const migratedConfig = this.transformConfig(legacyConfig);

      // 验证新配置
      const validatedConfig = configSchema.parse(migratedConfig);

      // 保存新配置
      await fs.writeFile(configPath, JSON.stringify(validatedConfig, null, 2));
      logger.info(`配置文件迁移完成: ${configPath}`);

      return validatedConfig;
    } catch (error) {
      logger.error('配置迁移失败:', error);
      throw new Error(`配置迁移失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 转换配置格式
   * @private
   * @param {LegacyConfig} legacyConfig 旧配置
   * @returns {Mark2pdfConfig} 新配置
   */
  private static transformConfig(legacyConfig: LegacyConfig): Mark2pdfConfig {
    return {
      input: {
        path: legacyConfig.input?.path || './public/md',
        extensions: legacyConfig.input?.extensions || ['.md'],
      },
      output: {
        path: legacyConfig.output?.path || './dist/pdf',
        createDirIfNotExist: legacyConfig.output?.createDirIfNotExist ?? true,
        maintainDirStructure: legacyConfig.output?.maintainDirStructure ?? true,
      },
      options: {
        concurrent: legacyConfig.options?.concurrent ?? 3,
        timeout: legacyConfig.options?.timeout ?? 30000,
        format: (legacyConfig.options?.format as any) || 'A4',
        orientation: (legacyConfig.options?.orientation as any) || 'portrait',
        toc: legacyConfig.options?.toc ?? false,
        cssPath: legacyConfig.options?.cssPath,
        overwrite: false,
      },
      features: {
        incremental: legacyConfig.features?.incremental ?? true,
        retry: legacyConfig.features?.retry ?? 2,
        cache: legacyConfig.features?.cache ?? true,
      },
    };
  }

  /**
   * 检查配置文件是否需要迁移
   * @param {string} configPath 配置文件路径
   * @returns {Promise<boolean>} 是否需要迁移
   */
  static async needsMigration(configPath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      // 检查是否为新格式
      try {
        configSchema.parse(config);
        return false;
      } catch {
        return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * 批量迁移配置文件
   * @param {string} [directory=process.cwd()] 目录路径
   * @returns {Promise<{migrated: string[], failed: string[]}>} 迁移结果
   */
  static async migrateAllConfigs(directory: string = process.cwd()): Promise<{migrated: string[], failed: string[]}> {
    const migrated: string[] = [];
    const failed: string[] = [];

    const configFiles = [
      'config.json',
      'mark2pdf.config.json',
      'merge.config.json'
    ];

    for (const configFile of configFiles) {
      const configPath = path.join(directory, configFile);
      
      try {
        if (await this.needsMigration(configPath)) {
          await this.migrateConfig(configPath);
          migrated.push(configPath);
        } else {
          logger.info(`配置文件无需迁移: ${configPath}`);
        }
      } catch (error) {
        logger.error(`迁移失败 ${configPath}:`, error);
        failed.push(configPath);
      }
    }

    return { migrated, failed };
  }

  /**
   * 生成配置文件模板
   * @param {string} outputPath 输出路径
   * @param {Mark2pdfConfig} [customConfig] 自定义配置
   * @returns {Promise<void>}
   */
  static async generateTemplate(outputPath: string, customConfig?: Partial<Mark2pdfConfig>): Promise<void> {
    const template: Mark2pdfConfig = {
      input: {
        path: './public/md',
        extensions: ['.md'],
      },
      output: {
        path: './dist/pdf',
        createDirIfNotExist: true,
        maintainDirStructure: true,
      },
      options: {
        concurrent: 3,
        timeout: 30000,
        format: 'A4',
        orientation: 'portrait',
        toc: false,
        overwrite: false,
      },
      features: {
        incremental: true,
        retry: 2,
        cache: true,
      },
      ...customConfig,
    };

    const content = JSON.stringify(template, null, 2);
    await fs.writeFile(outputPath, content);
    logger.info(`已生成配置模板: ${outputPath}`);
  }

  /**
   * 验证配置文件
   * @param {string} configPath 配置文件路径
   * @returns {Promise<{valid: boolean, errors: string[]}>} 验证结果
   */
  static async validateConfig(configPath: string): Promise<{valid: boolean, errors: string[]}> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      
      configSchema.parse(config);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(err => `${err.path.join('.')}: ${err.message}`);
        return { valid: false, errors };
      }
      return { 
        valid: false, 
        errors: [error instanceof Error ? error.message : String(error)] 
      };
    }
  }
}
