import fs from 'fs/promises';
import path from 'path';
import { configSchema, Mark2pdfConfig } from './schema';
import dotenv from 'dotenv';
import * as yaml from 'js-yaml';
import * as toml from 'toml';
import { PathValidator } from '../utils/pathValidator';

export class ConfigLoader {
  static async loadConfig(
    commandConfig: Partial<Mark2pdfConfig> = {}
  ): Promise<Mark2pdfConfig> {
    // 加载环境变量
    dotenv.config();

    // 获取默认配置作为基础
    const defaultConfig = this._getDefaultConfig();
    
    // 按优先级顺序加载其他配置
    const configs = [
      defaultConfig,
      await this._loadUserConfig(),
      await this._loadFileConfig(),
      await this._loadEnvConfig(),
      commandConfig,
    ];

    const merged = this._mergeConfigs(configs);
    const validated = this._validateConfig(merged);
    
    // 验证路径配置
    await this._validatePaths(validated);
    
    return validated;
  }

  private static _validateConfig(
    config: unknown
  ): Mark2pdfConfig {
    return configSchema.parse(config);
  }

  private static async _loadFileConfig(): Promise<Partial<Mark2pdfConfig>> {
    const searchPaths = [
      './mark2pdf.config.json',
      './mark2pdf.config.yaml',
      './mark2pdf.config.yml',
      './mark2pdf.config.toml',
      './config.json',
    ];

    for (const filePath of searchPaths) {
      if (await this._fileExists(filePath)) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          return this._parseConfigFile(content, path.extname(filePath));
        } catch (error) {
          console.warn(`Warning: Failed to read config file ${filePath}:`, error);
          return {};
        }
      }
    }
    return {};
  }

  private static async _loadUserConfig(): Promise<Partial<Mark2pdfConfig>> {
    const userConfigPath = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.mark2pdf',
      'config.json'
    );

    if (await this._fileExists(userConfigPath)) {
      const content = await fs.readFile(userConfigPath, 'utf-8');
      try {
        return JSON.parse(content);
      } catch (error) {
        console.warn(`Warning: Failed to parse user config at ${userConfigPath}`);
        return {};
      }
    }
    return {};
  }

  private static _loadEnvConfig(): Partial<Mark2pdfConfig> {
    const config: Partial<Mark2pdfConfig> = {};
    
    // 检查环境变量是否存在且不是 'undefined' 字符串
    if (process.env.MARK2PDF_INPUT_PATH && process.env.MARK2PDF_INPUT_PATH !== 'undefined') {
      config.input = { 
        path: process.env.MARK2PDF_INPUT_PATH,
        extensions: ['.md'],
      };
    }
    
    if (process.env.MARK2PDF_OUTPUT_PATH && process.env.MARK2PDF_OUTPUT_PATH !== 'undefined') {
      config.output = { 
        path: process.env.MARK2PDF_OUTPUT_PATH,
        createDirIfNotExist: true,
        maintainDirStructure: true,
      };
    }
    
    const optionsConfig: any = {};
    
    if (process.env.MARK2PDF_CONCURRENT && process.env.MARK2PDF_CONCURRENT !== 'undefined') {
      const concurrent = parseInt(process.env.MARK2PDF_CONCURRENT);
      if (!isNaN(concurrent)) {
        optionsConfig.concurrent = concurrent;
      }
    }
    
    if (process.env.MARK2PDF_TIMEOUT && process.env.MARK2PDF_TIMEOUT !== 'undefined') {
      const timeout = parseInt(process.env.MARK2PDF_TIMEOUT);
      if (!isNaN(timeout)) {
        optionsConfig.timeout = timeout;
      }
    }
    
    if (process.env.MARK2PDF_FORMAT && process.env.MARK2PDF_FORMAT !== 'undefined') {
      optionsConfig.format = process.env.MARK2PDF_FORMAT as 'A4' | 'Letter' | 'A3' | 'A5';
    }
    
    if (Object.keys(optionsConfig).length > 0) {
      config.options = optionsConfig;
    }
    
    // 只有当有实际配置时才返回
    return Object.keys(config).length > 0 ? config : {};
  }

  private static _mergeConfigs(
    configs: Array<Partial<Mark2pdfConfig>>
  ): Partial<Mark2pdfConfig> {
    const result = configs.reduce((acc, curr) => {
      if (!curr) return acc;
      return this._deepMerge(acc, curr);
    }, {});
    return result;
  }

  private static _deepMerge(
    target: any,
    source: any
  ): Record<string, any> {
    const result = { ...target };
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this._deepMerge(result[key] || {}, value);
      } else if (value !== undefined && value !== null) {
        result[key] = value;
      }
    }
    return result;
  }

  private static _getDefaultConfig(): Mark2pdfConfig {
    return {
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
    };
  }

  private static async _fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private static _parseConfigFile(content: string, extension: string): Partial<Mark2pdfConfig> {
    try {
      switch (extension) {
        case '.json':
          return JSON.parse(content);
        case '.yaml':
        case '.yml':
          return yaml.load(content) as Partial<Mark2pdfConfig>;
        case '.toml':
          return toml.parse(content) as Partial<Mark2pdfConfig>;
        default:
          throw new Error(`Unsupported config file format: ${extension}`);
      }
    } catch (error) {
      console.warn(`Warning: Failed to parse config file with extension ${extension}`);
      return {};
    }
  }

  private static async _validatePaths(config: Mark2pdfConfig): Promise<void> {
    // 验证输入路径
    const isInputPathValid = await PathValidator.validateInputPath(config.input.path);
    if (!isInputPathValid) {
      throw new Error(`Invalid input path: ${config.input.path}`);
    }

    // 验证输出路径
    const isOutputPathValid = await PathValidator.validateOutputPath(config.output.path);
    if (!isOutputPathValid) {
      throw new Error(`Invalid output path: ${config.output.path}`);
    }

    // 验证扩展名配置
    const areExtensionsValid = PathValidator.validateExtensions(config.input.extensions);
    if (!areExtensionsValid) {
      throw new Error(`Invalid extensions configuration: ${JSON.stringify(config.input.extensions)}`);
    }
  }
}
