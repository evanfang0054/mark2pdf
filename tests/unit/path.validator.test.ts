import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PathValidator } from '../../src/utils/pathValidator';
import fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises');
const mockFs = fs as any;

describe('PathValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isValidPathFormat', () => {
    it('应该验证有效的相对路径', () => {
      expect(PathValidator.isValidPathFormat('./public/md')).toBe(true);
      expect(PathValidator.isValidPathFormat('../input')).toBe(true);
      expect(PathValidator.isValidPathFormat('./dist/pdf')).toBe(true);
    });

    it('应该验证有效的绝对路径', () => {
      expect(PathValidator.isValidPathFormat('/home/user/docs')).toBe(true);
      expect(PathValidator.isValidPathFormat('/var/www/html')).toBe(true);
    });

    it('应该拒绝包含非法字符的路径', () => {
      expect(PathValidator.isValidPathFormat('./test<file')).toBe(false);
      expect(PathValidator.isValidPathFormat('./test>file')).toBe(false);
      expect(PathValidator.isValidPathFormat('./test:file')).toBe(false);
      expect(PathValidator.isValidPathFormat('./test"file')).toBe(false);
      expect(PathValidator.isValidPathFormat('./test|file')).toBe(false);
      expect(PathValidator.isValidPathFormat('./test?file')).toBe(false);
      expect(PathValidator.isValidPathFormat('./test*file')).toBe(false);
    });

    it('应该拒绝空路径或过长的路径', () => {
      expect(PathValidator.isValidPathFormat('')).toBe(false);
      expect(PathValidator.isValidPathFormat('a'.repeat(1025))).toBe(false);
    });

    it('应该拒绝非字符串路径', () => {
      expect(PathValidator.isValidPathFormat(null as any)).toBe(false);
      expect(PathValidator.isValidPathFormat(undefined as any)).toBe(false);
      expect(PathValidator.isValidPathFormat(123 as any)).toBe(false);
    });
  });

  describe('validateExtensions', () => {
    it('应该验证有效的扩展名配置', () => {
      expect(PathValidator.validateExtensions(['.md'])).toBe(true);
      expect(PathValidator.validateExtensions(['.md', '.markdown'])).toBe(true);
      expect(PathValidator.validateExtensions(['.txt', '.doc', '.pdf'])).toBe(true);
    });

    it('应该拒绝无效的扩展名配置', () => {
      expect(PathValidator.validateExtensions([])).toBe(false);
      expect(PathValidator.validateExtensions(['md'])).toBe(false); // 缺少点
      expect(PathValidator.validateExtensions(['.'])).toBe(false); // 只有点
      expect(PathValidator.validateExtensions(['.md', 'markdown'])).toBe(false); // 混合格式
    });

    it('应该拒绝非数组输入', () => {
      expect(PathValidator.validateExtensions(null as any)).toBe(false);
      expect(PathValidator.validateExtensions('.md' as any)).toBe(false);
    });
  });

  describe('isPathSafe', () => {
    it('应该识别安全的路径', () => {
      expect(PathValidator.isPathSafe('/home/user/project')).toBe(true);
      expect(PathValidator.isPathSafe('/tmp/project')).toBe(true);
      expect(PathValidator.isPathSafe('/Users/arwen/project')).toBe(true);
    });

    it('应该拒绝危险的路径', () => {
      expect(PathValidator.isPathSafe('/')).toBe(false);
      expect(PathValidator.isPathSafe('/etc')).toBe(false);
      expect(PathValidator.isPathSafe('/system')).toBe(false);
      expect(PathValidator.isPathSafe('/Windows')).toBe(false);
      expect(PathValidator.isPathSafe('/Program Files')).toBe(false);
    });
  });

  describe('normalizePath', () => {
    it('应该正确规范化路径', () => {
      const result1 = PathValidator.normalizePath('./public/md');
      const result2 = PathValidator.normalizePath('./dist/pdf');
      
      expect(result1).toContain('public/md');
      expect(result2).toContain('dist/pdf');
    });
  });

  describe('getPathInfo', () => {
    it('应该返回正确的路径信息', () => {
      const info = PathValidator.getPathInfo('./public/md');
      
      expect(info).toHaveProperty('original');
      expect(info).toHaveProperty('resolved');
      expect(info).toHaveProperty('normalized');
      expect(info).toHaveProperty('isAbsolute');
      expect(info).toHaveProperty('dirname');
      expect(info).toHaveProperty('basename');
      expect(info).toHaveProperty('extname');
      
      expect(info.original).toBe('./public/md');
      expect(info.basename).toBe('md');
      expect(info.extname).toBe('');
    });
  });

  describe('validateInputPath', () => {
    it('应该验证有效的输入路径', async () => {
      mockFs.access.mockResolvedValue(undefined);
      
      const result = await PathValidator.validateInputPath('./public/md');
      expect(result).toBe(true);
    });

    it('应该处理不存在的路径', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));
      
      const result = await PathValidator.validateInputPath('./nonexistent');
      expect(result).toBe(true); // 不存在的路径也是有效的
    });

    it('应该拒绝无效格式的路径', async () => {
      const result = await PathValidator.validateInputPath('./invalid<path');
      expect(result).toBe(false);
    });
  });

  describe('validateOutputPath', () => {
    it('应该验证有效的输出路径', async () => {
      mockFs.access.mockResolvedValue(undefined);
      
      const result = await PathValidator.validateOutputPath('./dist/pdf');
      expect(result).toBe(true);
    });

    it('应该能够创建不存在的输出路径', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      
      const result = await PathValidator.validateOutputPath('./new/dist');
      expect(result).toBe(true);
      expect(mockFs.mkdir).toHaveBeenCalled();
    });

    it('应该拒绝无法创建的输出路径', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));
      
      const result = await PathValidator.validateOutputPath('./restricted/dist');
      expect(result).toBe(false);
    });
  });
});