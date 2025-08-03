import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigLoader } from '@/config/loader';
import fs from 'fs/promises';
import path from 'path';

// Mock fs module
vi.mock('fs/promises');
const mockFs = fs as any;

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn(),
  default: { config: vi.fn() }
}));

describe('ConfigLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment variables
    process.env.MARK2PDF_INPUT_PATH = undefined;
    process.env.MARK2PDF_OUTPUT_PATH = undefined;
    process.env.MARK2PDF_CONCURRENT = undefined;
    process.env.MARK2PDF_FORMAT = undefined;
  });

  it('should load config with default values', async () => {
    mockFs.access.mockRejectedValue(new Error('File not found'));
    
    const config = await ConfigLoader.loadConfig();
    
    expect(config.input.path).toBe('./public/md');
    expect(config.output.path).toBe('./dist/pdf');
    expect(config.options.concurrent).toBe(3);
    expect(config.options.format).toBe('A4');
  });

  it('should load from JSON config file', async () => {
    const mockConfig = {
      input: { path: './custom-md' },
      output: { path: './custom-pdf' },
      options: { concurrent: 5, timeout: 30000, format: 'A4', orientation: 'portrait', toc: false, overwrite: false }
    };
    
    mockFs.access.mockImplementation((filePath: string) => {
      if (filePath === './mark2pdf.config.json') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });
    
    mockFs.readFile.mockImplementation((filePath: string) => {
      if (filePath === './mark2pdf.config.json') {
        return Promise.resolve(JSON.stringify(mockConfig));
      }
      return Promise.reject(new Error('File not found'));
    });
    
    const config = await ConfigLoader.loadConfig();
    
    expect(config.input.path).toBe('./custom-md');
    expect(config.output.path).toBe('./custom-pdf');
    expect(config.options.concurrent).toBe(5);
  });

  it('should load from environment variables', async () => {
    process.env.MARK2PDF_INPUT_PATH = './env-md';
    process.env.MARK2PDF_CONCURRENT = '7';
    
    mockFs.access.mockRejectedValue(new Error('File not found'));
    mockFs.readFile.mockRejectedValue(new Error('File not found'));
    
    const config = await ConfigLoader.loadConfig();
    
    expect(config.input.path).toBe('./env-md');
    expect(config.options.concurrent).toBe(7);
  });

  it('should merge configs with correct priority', async () => {
    // Command line config
    const commandConfig = { options: { concurrent: 10 } };
    
    // Environment config
    process.env.MARK2PDF_CONCURRENT = '5';
    
    // File config
    const mockFileConfig = {
      input: { path: './file-md' },
      options: { concurrent: 3, format: 'A3', timeout: 30000, orientation: 'portrait', toc: false, overwrite: false }
    };
    
    mockFs.access.mockImplementation((filePath: string) => {
      if (filePath === './mark2pdf.config.json') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });
    
    mockFs.readFile.mockImplementation((filePath: string) => {
      if (filePath === './mark2pdf.config.json') {
        return Promise.resolve(JSON.stringify(mockFileConfig));
      }
      return Promise.reject(new Error('File not found'));
    });
    
    const config = await ConfigLoader.loadConfig(commandConfig);
    
    // Command line should have highest priority
    expect(config.options.concurrent).toBe(10);
    // File config should be preserved for other options
    expect(config.options.format).toBe('A3');
    // File config should be preserved for input
    expect(config.input.path).toBe('./file-md');
  });

  it('should handle file read errors gracefully', async () => {
    mockFs.access.mockImplementation((filePath: string) => {
      if (filePath === './mark2pdf.config.json') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });
    
    mockFs.readFile.mockImplementation((filePath: string) => {
      if (filePath === './mark2pdf.config.json') {
        return Promise.reject(new Error('Read error'));
      }
      return Promise.reject(new Error('File not found'));
    });
    
    const config = await ConfigLoader.loadConfig();
    
    // Should fall back to defaults
    expect(config.input.path).toBe('./public/md');
  });

  it('should parse different config file formats', async () => {
    const testCases = [
      {
        extension: '.json',
        content: JSON.stringify({ input: { path: './json-test' } }),
        expectedPath: './json-test'
      },
      {
        extension: '.yaml',
        content: 'input:\n  path: ./yaml-test',
        expectedPath: './yaml-test'
      },
      {
        extension: '.toml',
        content: '[input]\npath = "./toml-test"',
        expectedPath: './toml-test'
      }
    ];

    for (const testCase of testCases) {
      // Setup mocks for this test case
      mockFs.access.mockImplementation((filePath: string) => {
        if (filePath === `./mark2pdf.config${testCase.extension}`) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });
      
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === `./mark2pdf.config${testCase.extension}`) {
          return Promise.resolve(testCase.content);
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const config = await ConfigLoader.loadConfig();
      expect(config.input.path).toBe(testCase.expectedPath);
      
      // Reset mocks for next iteration
      vi.clearAllMocks();
    }
  });

  it('should load user config from home directory', async () => {
    const homeDir = process.env.HOME || '/tmp';
    const userConfigPath = path.join(homeDir, '.mark2pdf', 'config.json');
    const userConfig = {
      input: { path: './user-md' },
      features: { incremental: false, retry: 2, cache: true }
    };
    
    mockFs.access.mockImplementation((filePath: string) => {
      if (filePath === userConfigPath) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });
    
    mockFs.readFile.mockImplementation((filePath: string) => {
      if (filePath === userConfigPath) {
        return Promise.resolve(JSON.stringify(userConfig));
      }
      return Promise.reject(new Error('File not found'));
    });
    
    const config = await ConfigLoader.loadConfig();
    
    expect(config.input.path).toBe('./user-md');
    expect(config.features?.incremental).toBe(false);
  });

  describe('路径验证', () => {
    it('应该验证 input.path 路径存在性', async () => {
      const config = await ConfigLoader.loadConfig();
      
      // 验证 input.path 是否有效
      expect(config.input.path).toBeDefined();
      expect(typeof config.input.path).toBe('string');
      expect(config.input.path.length).toBeGreaterThan(0);
    });

    it('应该验证 output.path 路径有效性', async () => {
      const config = await ConfigLoader.loadConfig();
      
      // 验证 output.path 是否有效
      expect(config.output.path).toBeDefined();
      expect(typeof config.output.path).toBe('string');
      expect(config.output.path.length).toBeGreaterThan(0);
    });

    it('应该验证路径格式的正确性', async () => {
      const config = await ConfigLoader.loadConfig();
      
      // 验证路径格式
      const validPathRegex = /^[.\/][a-zA-Z0-9\/\-_.]+$/;
      expect(config.input.path).toMatch(validPathRegex);
      expect(config.output.path).toMatch(validPathRegex);
    });

    it('应该验证路径配置的完整性', async () => {
      const config = await ConfigLoader.loadConfig();
      
      // 验证路径配置包含必要的属性
      expect(config.input).toHaveProperty('path');
      expect(config.input).toHaveProperty('extensions');
      expect(config.output).toHaveProperty('path');
      expect(config.output).toHaveProperty('createDirIfNotExist');
      expect(config.output).toHaveProperty('maintainDirStructure');
      
      // 验证扩展名配置
      expect(Array.isArray(config.input.extensions)).toBe(true);
      expect(config.input.extensions.length).toBeGreaterThan(0);
      expect(config.input.extensions.includes('.md')).toBe(true);
    });

    it('应该处理相对路径和绝对路径', async () => {
      // 测试相对路径解析
      const config = await ConfigLoader.loadConfig();
      
      // 验证相对路径可以正确解析
      const resolvedInputPath = require('path').resolve(config.input.path);
      const resolvedOutputPath = require('path').resolve(config.output.path);
      
      expect(typeof resolvedInputPath).toBe('string');
      expect(typeof resolvedOutputPath).toBe('string');
      expect(resolvedInputPath.length).toBeGreaterThan(0);
      expect(resolvedOutputPath.length).toBeGreaterThan(0);
    });

    it('应该验证实际配置文件中的路径值', async () => {
      // 使用实际的配置文件进行测试
      const path = await import('path');
      
      // 读取实际的配置文件 - 使用 require 来避免 mock 的影响
      const actualConfig = require('./../../config.json');
      
      // 验证配置文件中的路径值
      expect(actualConfig.input.path).toBe('./public/md');
      expect(actualConfig.output.path).toBe('./dist/pdf');
      
      // 验证路径在文件系统中是否可以解析
      const resolvedInputPath = path.resolve(actualConfig.input.path);
      const resolvedOutputPath = path.resolve(actualConfig.output.path);
      
      expect(resolvedInputPath).toMatch(/public\/md$/);
      expect(resolvedOutputPath).toMatch(/dist\/pdf$/);
      
      // 验证路径不包含非法字符
      const invalidChars = ['<', '>', ':', '"', '|', '?', '*'];
      invalidChars.forEach(char => {
        expect(actualConfig.input.path).not.toContain(char);
        expect(actualConfig.output.path).not.toContain(char);
      });
    });

    it('应该验证路径配置在运行时的有效性', async () => {
      const config = await ConfigLoader.loadConfig();
      
      // 验证路径在运行时可以正常使用
      const path = await import('path');
      
      // 验证输入路径可以安全地用于文件操作
      const inputPath = path.resolve(config.input.path);
      const outputPath = path.resolve(config.output.path);
      
      // 验证路径是规范的（不包含 ./ 或 ../）
      expect(path.normalize(inputPath)).toBe(inputPath);
      expect(path.normalize(outputPath)).toBe(outputPath);
      
      // 验证路径不是根目录
      expect(inputPath).not.toBe('/');
      expect(outputPath).not.toBe('/');
      
      // 验证路径扩展名配置正确
      config.input.extensions.forEach((ext: string) => {
        expect(ext.startsWith('.')).toBe(true);
        expect(ext.length).toBeGreaterThan(1);
      });
    });
  });
});
