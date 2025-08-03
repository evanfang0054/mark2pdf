import path from 'path';
import { Mark2pdfConfig } from '../config/schema';

/**
 * 路径处理工具类
 */
export class PathUtils {
  /**
   * 获取输出文件路径
   * @param {string} inputPath 输入文件路径
   * @param {Mark2pdfConfig} config 配置对象
   * @returns {string} 输出文件路径
   */
  static getOutputPath(inputPath: string, config: Mark2pdfConfig): string {
    const relativePath = path.relative(
      path.resolve(config.input.path),
      inputPath
    );
    const pdfFileName = path.basename(inputPath, path.extname(inputPath)) + '.pdf';
    return path.join(
      path.resolve(config.output.path),
      path.dirname(relativePath),
      pdfFileName
    );
  }

  /**
   * 规范化路径
   * @param {string} filePath 文件路径
   * @returns {string} 规范化后的路径
   */
  static normalizePath(filePath: string): string {
    return path.normalize(filePath);
  }

  /**
   * 获取绝对路径
   * @param {string} filePath 文件路径
   * @param {string} [basePath] 基础路径，默认为当前工作目录
   * @returns {string} 绝对路径
   */
  static getAbsolutePath(filePath: string, basePath?: string): string {
    const resolvedBase = basePath ? path.resolve(basePath) : process.cwd();
    return path.resolve(resolvedBase, filePath);
  }

  /**
   * 获取相对路径
   * @param {string} fromPath 源路径
   * @param {string} toPath 目标路径
   * @returns {string} 相对路径
   */
  static getRelativePath(fromPath: string, toPath: string): string {
    return path.relative(fromPath, toPath);
  }

  /**
   * 获取文件扩展名
   * @param {string} filePath 文件路径
   * @returns {string} 文件扩展名（包含点）
   */
  static getExtension(filePath: string): string {
    return path.extname(filePath);
  }

  /**
   * 获取文件名（不含扩展名）
   * @param {string} filePath 文件路径
   * @returns {string} 文件名
   */
  static getFileNameWithoutExtension(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
  }

  /**
   * 获取文件名（含扩展名）
   * @param {string} filePath 文件路径
   * @returns {string} 文件名
   */
  static getFileName(filePath: string): string {
    return path.basename(filePath);
  }

  /**
   * 获取目录名
   * @param {string} filePath 文件路径
   * @returns {string} 目录名
   */
  static getDirName(filePath: string): string {
    return path.dirname(filePath);
  }

  /**
   * 连接路径
   * @param {...string[]} paths 路径片段
   * @returns {string} 连接后的路径
   */
  static join(...paths: string[]): string {
    return path.join(...paths);
  }

  /**
   * 解析路径
   * @param {string} filePath 文件路径
   * @returns {path.ParsedPath} 解析结果
   */
  static parsePath(filePath: string): path.ParsedPath {
    return path.parse(filePath);
  }

  /**
   * 检查路径是否为绝对路径
   * @param {string} filePath 文件路径
   * @returns {boolean} 是否为绝对路径
   */
  static isAbsolute(filePath: string): boolean {
    return path.isAbsolute(filePath);
  }

  /**
   * 获取路径的目录部分
   * @param {string} filePath 文件路径
   * @returns {string} 目录路径
   */
  static getDirectory(filePath: string): string {
    return path.dirname(filePath);
  }

  /**
   * 转换路径分隔符为当前系统格式
   * @param {string} filePath 文件路径
   * @returns {string} 转换后的路径
   */
  static toSystemPath(filePath: string): string {
    return filePath.split(/[\\/]/).join(path.sep);
  }

  /**
   * 转换路径分隔符为 POSIX 格式
   * @param {string} filePath 文件路径
   * @returns {string} 转换后的路径
   */
  static toPosixPath(filePath: string): string {
    return filePath.split(/[\\/]/).join('/');
  }
}

// 导出工具函数实例以保持向后兼容
export const {
  getOutputPath,
  normalizePath,
  getAbsolutePath,
  getRelativePath,
  getExtension,
  getFileNameWithoutExtension,
  getFileName,
  getDirName,
  join,
  parsePath,
  isAbsolute,
  getDirectory,
  toSystemPath,
  toPosixPath
} = PathUtils;
