import { describe, it, expect } from 'vitest';
import { ConfigLoader } from '../../src/config/loader';
import { PathValidator } from '../../src/utils/pathValidator';
import fs from 'fs/promises';

describe('配置文件路径验证', () => {
  it('应该验证实际配置文件中的路径值', async () => {
    // 读取实际的配置文件
    const configContent = await fs.readFile('./config.json', 'utf-8');
    const actualConfig = JSON.parse(configContent);
    
    // 验证配置文件中的路径值
    expect(actualConfig.input.path).toBe('./public/md');
    expect(actualConfig.output.path).toBe('./public_dist/pdf');
    
    // 使用路径验证工具验证这些路径
    const isInputPathValid = await PathValidator.validateInputPath(actualConfig.input.path);
    const isOutputPathValid = await PathValidator.validateOutputPath(actualConfig.output.path);
    
    expect(isInputPathValid).toBe(true);
    expect(isOutputPathValid).toBe(true);
    
    // 验证扩展名配置
    const areExtensionsValid = PathValidator.validateExtensions(actualConfig.input.extensions);
    expect(areExtensionsValid).toBe(true);
  });

  it('应该验证配置加载器能正确处理路径验证', async () => {
    // 测试配置加载器是否能成功加载并验证配置
    const config = await ConfigLoader.loadConfig();
    
    // 验证配置中的路径
    expect(config.input.path).toBeDefined();
    expect(config.output.path).toBeDefined();
    
    // 验证路径格式
    expect(PathValidator.isValidPathFormat(config.input.path)).toBe(true);
    expect(PathValidator.isValidPathFormat(config.output.path)).toBe(true);
    
    // 验证扩展名
    expect(PathValidator.validateExtensions(config.input.extensions)).toBe(true);
  });

  it('应该验证路径的安全性和规范性', async () => {
    const config = await ConfigLoader.loadConfig();
    
    // 获取路径信息
    const inputInfo = PathValidator.getPathInfo(config.input.path);
    const outputInfo = PathValidator.getPathInfo(config.output.path);
    
    // 验证路径是相对路径
    expect(inputInfo.isAbsolute).toBe(false);
    expect(outputInfo.isAbsolute).toBe(false);
    
    // 验证路径解析后的安全性
    expect(PathValidator.isPathSafe(inputInfo.resolved)).toBe(true);
    expect(PathValidator.isPathSafe(outputInfo.resolved)).toBe(true);
    
    // 验证路径规范化
    const normalizedInput = PathValidator.normalizePath(config.input.path);
    const normalizedOutput = PathValidator.normalizePath(config.output.path);
    
    expect(normalizedInput).toBe(inputInfo.normalized);
    expect(normalizedOutput).toBe(outputInfo.normalized);
  });

  it('应该验证配置文件中的具体路径值', async () => {
    // 直接验证配置文件中的值
    const config = require('./../../config.json');
    
    // 验证input.path
    expect(config.input.path).toBe('./public/md');
    expect(config.input.path).toMatch(/^\.[\/\\]public[\/\\]md$/);
    
    // 验证output.path
    expect(config.output.path).toBe('./public_dist/pdf');
    expect(config.output.path).toMatch(/^\.[\/\\]public_dist[\/\\]pdf$/);
    
    // 验证扩展名配置
    expect(config.input.extensions).toEqual(['.md']);
    
    // 验证output配置的完整性
    expect(config.output.createDirIfNotExist).toBe(true);
    expect(config.output.maintainDirStructure).toBe(true);
  });

  it('应该验证路径在运行时的实际可用性', async () => {
    const config = await ConfigLoader.loadConfig();
    
    // 验证输入路径可以解析为绝对路径
    const inputPath = PathValidator.normalizePath(config.input.path);
    const outputPath = PathValidator.normalizePath(config.output.path);
    
    // 验证路径解析正确
    expect(inputPath).toContain('public/md');
    expect(outputPath).toContain('dist/pdf');
    
    // 验证路径不是根目录
    expect(inputPath).not.toBe('/');
    expect(outputPath).not.toBe('/');
    
    // 验证路径不包含非法字符
    const invalidChars = ['<', '>', ':', '"', '|', '?', '*'];
    invalidChars.forEach(char => {
      expect(config.input.path).not.toContain(char);
      expect(config.output.path).not.toContain(char);
    });
  });
});