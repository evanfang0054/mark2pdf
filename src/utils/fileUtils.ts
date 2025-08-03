import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';

/**
 * 文件扫描结果接口
 */
export interface FileScanResult {
  files: string[];
  subDirs: string[];
}

/**
 * 文件处理函数类型
 */
export type FileProcessor = (chunk: Buffer) => Buffer;

/**
 * 文件操作工具类
 */
export class FileUtils {
  /**
   * 确保目录存在，不存在则创建
   * @param {string} dirPath 目录路径
   */
  static async ensureDir(dirPath: string): Promise<void> {
    try {
      await fsPromises.access(dirPath);
    } catch {
      await fsPromises.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 检查文件是否为 Markdown 文件
   * @param {string} filePath 文件路径
   * @returns {boolean} 是否为 Markdown 文件
   */
  static isMarkdownFile(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.md';
  }

  /**
   * 递归获取指定目录下所有指定扩展名的文件
   * @param {string} dirPath 目录路径
   * @param {string} extension 文件扩展名
   * @param {boolean} [includeDirs=false] 是否包含子目录信息
   * @returns {Promise<string[]|FileScanResult>} 文件路径数组或包含子目录信息的对象
   */
  static async getAllFiles(
    dirPath: string, 
    extension: string, 
    includeDirs: boolean = false
  ): Promise<string[] | FileScanResult> {
    try {
      const files = await fsPromises.readdir(dirPath);
      const result = includeDirs ? { files: [] as string[], subDirs: [] as string[] } : [] as string[];

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fsPromises.stat(filePath);

        if (stats.isDirectory()) {
          if (includeDirs) {
            (result as FileScanResult).subDirs.push(filePath);
            const subResults = await FileUtils.getAllFiles(filePath, extension, includeDirs) as FileScanResult;
            (result as FileScanResult).files.push(...subResults.files);
          } else {
            const subFiles = await FileUtils.getAllFiles(filePath, extension, includeDirs) as string[];
            (result as string[]).push(...subFiles);
          }
        } else if (path.extname(file).toLowerCase() === extension) {
          if (includeDirs) {
            (result as FileScanResult).files.push(filePath);
          } else {
            (result as string[]).push(filePath);
          }
        }
      }

      return result;
    } catch (error) {
      console.error(`读取目录失败 ${dirPath}:`, error instanceof Error ? error.message : String(error));
      return includeDirs ? { files: [], subDirs: [] } : [];
    }
  }

  /**
   * 创建文件读取流
   * @param {string} filePath 文件路径
   * @returns {Promise<Readable>} 可读流
   */
  static async readFileStream(filePath: string): Promise<Readable> {
    return fs.createReadStream(filePath, { 
      highWaterMark: 64 * 1024 // 64KB chunks
    });
  }

  /**
   * 写入文件流
   * @param {string} filePath 文件路径
   * @param {Readable} content 可读流内容
   * @returns {Promise<void>}
   */
  static async writeFileStream(filePath: string, content: Readable): Promise<void> {
    const writeStream = fs.createWriteStream(filePath);
    await pipeline(content, writeStream);
  }

  /**
   * 处理大文件
   * @param {string} inputPath 输入文件路径
   * @param {string} outputPath 输出文件路径
   * @param {FileProcessor} processor 文件处理函数
   * @returns {Promise<void>}
   */
  static async processLargeFile(
    inputPath: string, 
    outputPath: string, 
    processor: FileProcessor
  ): Promise<void> {
    const readStream = await FileUtils.readFileStream(inputPath);
    const transform = new Transform({
      transform(chunk: Buffer, _encoding: string, callback: (error: Error | null, data: Buffer) => void) {
        const processed = processor(chunk);
        callback(null, processed);
      }
    });
    await pipeline(readStream, transform, fs.createWriteStream(outputPath));
  }

  /**
   * 获取文件的相对路径
   * @param {string} fullPath 完整路径
   * @param {string} basePath 基础路径
   * @returns {string} 相对路径
   */
  static getRelativePath(fullPath: string, basePath: string): string {
    return path.relative(basePath, fullPath);
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath 文件路径
   * @returns {Promise<boolean>} 是否存在
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件大小
   * @param {string} filePath 文件路径
   * @returns {Promise<number>} 文件大小（字节）
   */
  static async getFileSize(filePath: string): Promise<number> {
    const stats = await fsPromises.stat(filePath);
    return stats.size;
  }

  /**
   * 复制文件
   * @param {string} sourcePath 源文件路径
   * @param {string} destPath 目标文件路径
   * @returns {Promise<void>}
   */
  static async copyFile(sourcePath: string, destPath: string): Promise<void> {
    await fsPromises.copyFile(sourcePath, destPath);
  }

  /**
   * 删除文件
   * @param {string} filePath 文件路径
   * @returns {Promise<void>}
   */
  static async deleteFile(filePath: string): Promise<void> {
    await fsPromises.unlink(filePath);
  }

  /**
   * 清空目录
   * @param {string} dirPath 目录路径
   * @returns {Promise<void>}
   */
  static async emptyDir(dirPath: string): Promise<void> {
    const files = await fsPromises.readdir(dirPath);
    await Promise.all(files.map(file => {
      const filePath = path.join(dirPath, file);
      return fsPromises.rm(filePath, { recursive: true, force: true });
    }));
  }
}

// 导出工具函数实例以保持向后兼容
export const {
  ensureDir,
  isMarkdownFile,
  getAllFiles,
  readFileStream,
  writeFileStream,
  processLargeFile,
  getRelativePath,
  fileExists,
  getFileSize,
  copyFile,
  deleteFile,
  emptyDir
} = FileUtils;
