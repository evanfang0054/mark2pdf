import fs from 'fs/promises';
import path from 'path';

/**
 * 路径验证工具
 */
export class PathValidator {
  /**
   * 验证输入路径的有效性
   * @param inputPath 输入路径
   * @returns Promise<boolean> 是否有效
   */
  static async validateInputPath(inputPath: string): Promise<boolean> {
    try {
      const resolvedPath = path.resolve(inputPath);
      
      // 检查路径格式
      if (!this.isValidPathFormat(inputPath)) {
        return false;
      }
      
      // 检查路径是否安全
      if (!this.isPathSafe(resolvedPath)) {
        return false;
      }
      
      // 检查路径是否存在（可选）
      try {
        await fs.access(resolvedPath, fs.constants.R_OK);
      } catch {
        // 如果路径不存在，这是可以接受的，因为后续可能会创建
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 验证输出路径的有效性
   * @param outputPath 输出路径
   * @returns Promise<boolean> 是否有效
   */
  static async validateOutputPath(outputPath: string): Promise<boolean> {
    try {
      const resolvedPath = path.resolve(outputPath);
      
      // 检查路径格式
      if (!this.isValidPathFormat(outputPath)) {
        return false;
      }
      
      // 检查路径是否安全
      if (!this.isPathSafe(resolvedPath)) {
        return false;
      }
      
      // 检查父目录是否存在或是否可以创建
      const parentDir = path.dirname(resolvedPath);
      try {
        await fs.access(parentDir, fs.constants.W_OK);
      } catch {
        // 如果父目录不存在，检查是否可以创建
        try {
          await fs.mkdir(parentDir, { recursive: true });
        } catch {
          return false;
        }
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 验证路径格式是否正确
   * @param pathStr 路径字符串
   * @returns boolean 是否有效
   */
  static isValidPathFormat(pathStr: string): boolean {
    if (!pathStr || typeof pathStr !== 'string') {
      return false;
    }
    
    // 检查长度
    if (pathStr.length === 0 || pathStr.length > 1024) {
      return false;
    }
    
    // 检查非法字符
    const invalidChars = ['<', '>', ':', '"', '|', '?', '*'];
    if (invalidChars.some(char => pathStr.includes(char))) {
      return false;
    }
    
    // 检查路径格式（相对路径或绝对路径）
    const validPathRegex = /^[.\/]?[a-zA-Z0-9\/\-_.]+$/;
    return validPathRegex.test(pathStr);
  }

  /**
   * 检查路径是否安全
   * @param resolvedPath 解析后的路径
   * @returns boolean 是否安全
   */
  static isPathSafe(resolvedPath: string): boolean {
    // 检查是否是根目录
    if (resolvedPath === '/') {
      return false;
    }
    
    // 检查是否包含危险路径
    const dangerousPaths = ['/etc', '/system', '/Windows', '/Program Files'];
    if (dangerousPaths.some(dangerous => resolvedPath.startsWith(dangerous))) {
      return false;
    }
    
    return true;
  }

  /**
   * 验证文件扩展名配置
   * @param extensions 扩展名数组
   * @returns boolean 是否有效
   */
  static validateExtensions(extensions: string[]): boolean {
    if (!Array.isArray(extensions) || extensions.length === 0) {
      return false;
    }
    
    return extensions.every(ext => {
      if (typeof ext !== 'string') return false;
      if (!ext.startsWith('.')) return false;
      if (ext.length <= 1) return false;
      
      // 检查扩展名格式
      const validExtRegex = /^\.[a-zA-Z0-9]+$/;
      return validExtRegex.test(ext);
    });
  }

  /**
   * 规范化路径
   * @param pathStr 路径字符串
   * @returns string 规范化后的路径
   */
  static normalizePath(pathStr: string): string {
    return path.normalize(path.resolve(pathStr));
  }

  /**
   * 获取路径信息
   * @param pathStr 路径字符串
   * @returns Object 路径信息
   */
  static getPathInfo(pathStr: string) {
    const resolved = path.resolve(pathStr);
    const normalized = path.normalize(resolved);
    
    return {
      original: pathStr,
      resolved,
      normalized,
      isAbsolute: path.isAbsolute(pathStr),
      dirname: path.dirname(resolved),
      basename: path.basename(resolved),
      extname: path.extname(resolved),
    };
  }
}