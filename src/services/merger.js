const PdfMerger = require('../core/PdfMerger');
const { getAllFiles, ensureDir } = require('../utils/fileUtils');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const EventEmitter = require('../utils/EventEmitter');

/**
 * 合并服务类
 * 负责管理 PDF 文件的批量合并流程
 */
class MergerService {
  /**
   * 创建合并服务实例
   * @param {Object} config 配置对象
   */
  constructor(config) {
    this.config = config;
    this.merger = new PdfMerger(config);
    this.batchSize = 1000; // 批量处理大小
  }

  /**
   * 执行批量合并
   * @returns {Promise<void>}
   */
  async mergeAll() {
    try {
      const inputDir = path.resolve(this.config.input.path);
      const outputDir = path.resolve(this.config.output.path);
      
      await this._ensureOutputDir(outputDir);
      await this._processDirectory(inputDir, outputDir, true);
      
      logger.success('所有 PDF 合并完成！');
    } catch (error) {
      logger.error('合并过程出错:', error.message);
      throw error;
    }
  }

  /**
   * 处理目录
   * @private
   * @param {string} dirPath 目录路径
   * @param {string} outputDir 输出目录
   * @param {boolean} isRoot 是否为根目录
   */
  async _processDirectory(dirPath, outputDir, isRoot = true) {
    const { files: pdfFiles, subDirs } = await this._scanDirectory(dirPath);
    
    if (!isRoot && pdfFiles.length > 0) {
      await this._mergeDirectoryFiles(dirPath, pdfFiles, outputDir);
    }

    await Promise.all(
      subDirs.map(subDir => 
        this._processDirectory(subDir, outputDir, false)
      )
    );
  }

  /**
   * 扫描目录获取 PDF 文件
   * @private
   * @param {string} dirPath 目录路径
   * @returns {Promise<{files: string[], subDirs: string[]}>} 包含文件和子目录的对象
   */
  async _scanDirectory(dirPath) {
    try {
      return await getAllFiles(dirPath, '.pdf', true);
    } catch (error) {
      logger.error(`扫描目录失败 ${dirPath}:`, error.message);
      return { files: [], subDirs: [] };
    }
  }

  /**
   * 合并目录中的 PDF 文件
   * @private
   * @param {string} dirPath 目录路径
   * @param {string[]} pdfFiles PDF 文件路径数组
   * @param {string} outputDir 输出目录
   */
  async _mergeDirectoryFiles(dirPath, pdfFiles, outputDir) {
    const folderName = path.basename(dirPath);
    const outputPath = path.join(outputDir, `${folderName}.pdf`);

    if (await this._shouldSkipMerge(outputPath)) {
      logger.info(`跳过已存在的文件: ${outputPath}`);
      return;
    }

    try {
      EventEmitter.emit('status', {
        type: 'info',
        message: `正在处理: ${folderName}`
      });
      
      await this.merger.merge(pdfFiles, outputPath);
      
      EventEmitter.emit('status', {
        type: 'success', 
        message: `${folderName} 处理完成`
      });
    } catch (error) {
      EventEmitter.emit('status', {
        type: 'error',
        message: `${folderName} 处理失败: ${error.message}`
      });
      throw error;
    }
  }

  /**
   * 检查是否应该跳过合并
   * @private
   * @param {string} outputPath 输出文件路径
   * @returns {Promise<boolean>} 是否应该跳过
   */
  async _shouldSkipMerge(outputPath) {
    if (!this.config.options.overwrite) {
      try {
        await fs.access(outputPath);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * 确保输出目录存在
   * @private
   * @param {string} outputDir 输出目录路径
   */
  async _ensureOutputDir(outputDir) {
    if (this.config.output.createDirIfNotExist) {
      await ensureDir(outputDir);
    }
  }

  async mergeFiles(files) {
    const batches = this.splitIntoBatches(files, this.batchSize);
    const results = [];
    
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(file => this.processFile(file))
      );
      results.push(...batchResults);
      
      // 主动触发GC
      if (global.gc) {
        global.gc();
      }
    }
    
    return results;
  }
  
  splitIntoBatches(items, size) {
    return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
      items.slice(i * size, (i + 1) * size)
    );
  }
}

async function mergeFiles(sourceDir, targetDir, config) {
  const files = await getAllFiles(sourceDir);
  
  for (const file of files) {
    // 获取相对路径
    const relativePath = path.relative(sourceDir, file);
    
    // 如果需要保持目录结构
    if (config.maintainDirStructure) {
      // 构建目标文件完整路径
      const targetPath = path.join(targetDir, relativePath);
      // 确保目标目录存在
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      // 复制文件到对应位置
      await fs.promises.copyFile(file, targetPath);
    } else {
      // 原有的平铺复制逻辑
      const fileName = path.basename(file);
      const targetPath = path.join(targetDir, fileName);
      await fs.promises.copyFile(file, targetPath);
    }
  }
}

module.exports = MergerService; 