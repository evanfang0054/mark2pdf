import { Mark2pdfConfig } from '../config/schema';
import { PdfConverter, ConversionResult } from '../core/PdfConverter';
import { ProgressIndicator } from '../utils/progress';
import { getAllFiles } from '../utils/fileUtils';
import chalk from 'chalk';

export interface ConversionSummary {
  total: number;
  success: number;
  failed: number;
  duration: number;
  successRate: number;
  failedFiles: Array<{ file: string; error: string }>;
}

/**
 * 转换服务类
 * 负责管理 Markdown 到 PDF 的批量转换流程
 */
export class ConverterService {
  private config: Mark2pdfConfig;
  private converter: PdfConverter;
  private progress: ProgressIndicator;
  private startTime: number = 0;
  private cache: Map<string, ConversionResult> = new Map();
  private readonly cacheSize: number = 100;

  constructor(config: Mark2pdfConfig, progress: ProgressIndicator) {
    this.config = config;
    this.converter = new PdfConverter(config, progress);
    this.progress = progress;
  }

  /**
   * 执行批量转换
   * @returns Promise<ConversionSummary> 转换摘要
   */
  async convertAll(): Promise<ConversionSummary> {
    try {
      this.startTime = Date.now();
      
      // 文件扫描阶段
      this.progress.info('正在扫描 Markdown 文件...');
      const mdFiles = await this._getMdFiles();
      
      if (mdFiles.length === 0) {
        this.progress.warn('未找到任何 Markdown 文件');
        return {
          total: 0,
          success: 0,
          failed: 0,
          duration: 0,
          successRate: 0,
          failedFiles: []
        };
      }
      
      this.progress.info(`找到 ${chalk.cyan(mdFiles.length.toString())} 个 Markdown 文件`);

      // 转换阶段
      const results = await this._processBatch(mdFiles);
      const summary = this._createSummary(results);
      this._printSummary(summary);
      
      // 清理阶段
      await this._cleanup();
      
      return summary;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.progress.error(`转换过程出错: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取所有 Markdown 文件
   * @private
   * @returns Promise<string[]> Markdown 文件路径数组
   */
  private async _getMdFiles(): Promise<string[]> {
    const extensions = this.config.input.extensions || ['.md'];
    const files: string[] = [];
    
    for (const ext of extensions) {
      const result = await getAllFiles(this.config.input.path, ext);
      const extFiles = Array.isArray(result) ? result : result.files;
      files.push(...extFiles);
    }
    
    // 应用过滤器
    if (this.config.input.filters) {
      return this._applyFilters(files);
    }
    
    return files;
  }

  /**
   * 应用文件过滤器
   * @private
   * @param files 文件列表
   * @returns 过滤后的文件列表
   */
  private _applyFilters(files: string[]): string[] {
    const { include, exclude } = this.config.input.filters || {};
    
    let filteredFiles = files;
    
    if (include && include.length > 0) {
      const includePatterns = include.map(pattern => new RegExp(pattern));
      filteredFiles = filteredFiles.filter(file => 
        includePatterns.some(pattern => pattern.test(file))
      );
    }
    
    if (exclude && exclude.length > 0) {
      const excludePatterns = exclude.map(pattern => new RegExp(pattern));
      filteredFiles = filteredFiles.filter(file => 
        !excludePatterns.some(pattern => pattern.test(file))
      );
    }
    
    return filteredFiles;
  }

  /**
   * 批量处理文件
   * @private
   * @param files 文件路径数组
   * @returns Promise<ConversionResult[]> 处理结果
   */
  private async _processBatch(files: string[]): Promise<ConversionResult[]> {
    // 如果启用了增量转换，过滤掉已转换的文件
    if (this.config.features?.incremental) {
      const filesToConvert = await this._filterChangedFiles(files);
      if (filesToConvert.length === 0) {
        this.progress.info('所有文件都是最新的，无需转换');
        return [];
      }
      this.progress.info(`需要转换 ${filesToConvert.length} 个文件`);
      return this.converter.convertBatch(filesToConvert);
    }
    
    return this.converter.convertBatch(files);
  }

  /**
   * 过滤出需要重新转换的文件
   * @private
   * @param files 所有文件列表
   * @returns 需要转换的文件列表
   */
  private async _filterChangedFiles(files: string[]): Promise<string[]> {
    const filesToConvert: string[] = [];
    
    for (const file of files) {
      const needsConversion = await this._needsConversion(file);
      if (needsConversion) {
        filesToConvert.push(file);
      }
    }
    
    return filesToConvert;
  }

  /**
   * 检查文件是否需要转换
   * @private
   * @param file 文件路径
   * @returns 是否需要转换
   */
  private async _needsConversion(file: string): Promise<boolean> {
    try {
      const outputPath = this._getOutputPath(file);
      const [inputStat, outputStat] = await Promise.all([
        require('fs').promises.stat(file),
        require('fs').promises.stat(outputPath).catch(() => null)
      ]);
      
      // 如果输出文件不存在，需要转换
      if (!outputStat) {
        return true;
      }
      
      // 如果输入文件比输出文件新，需要转换
      return inputStat.mtime > outputStat.mtime;
    } catch {
      // 如果检查过程中出现错误，默认需要转换
      return true;
    }
  }

  /**
   * 获取输出文件路径
   * @private
   * @param inputFile 输入文件路径
   * @returns 输出文件路径
   */
  private _getOutputPath(inputFile: string): string {
    const relativePath = require('path').relative(this.config.input.path, inputFile);
    const baseName = require('path').basename(relativePath, require('path').extname(relativePath));
    
    if (this.config.output.renamePattern) {
      // 应用重命名模式
      return require('path').join(
        this.config.output.path,
        this.config.output.renamePattern.replace('{name}', baseName) + '.pdf'
      );
    }
    
    return require('path').join(
      this.config.output.path,
      require('path').dirname(relativePath),
      baseName + '.pdf'
    );
  }

  /**
   * 创建转换摘要
   * @private
   * @param results 转换结果
   * @returns ConversionSummary 转换摘要
   */
  private _createSummary(results: ConversionResult[]): ConversionSummary {
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const total = results.length;
    const duration = Date.now() - this.startTime;
    const successRate = total > 0 ? (success / total) * 100 : 0;
    const failedFiles = results
      .filter(r => !r.success)
      .map(r => ({ file: r.file, error: r.error || '未知错误' }));

    return {
      total,
      success,
      failed,
      duration,
      successRate,
      failedFiles
    };
  }

  /**
   * 打印转换结果摘要
   * @private
   * @param summary 转换摘要
   */
  private _printSummary(summary: ConversionSummary): void {
    const duration = (summary.duration / 1000).toFixed(2);
    
    console.log('\n' + chalk.bold('📊 转换报告'));
    console.log('━'.repeat(50));
    console.log(`总耗时: ${chalk.cyan(duration)} 秒`);
    console.log(`总文件: ${chalk.white(summary.total.toString())}`);
    console.log(`成功数: ${chalk.green(summary.success.toString())}`);
    console.log(`失败数: ${chalk.red(summary.failed.toString())}`);
    console.log(`成功率: ${chalk.cyan(summary.successRate.toFixed(1))}%`);
    console.log('━'.repeat(50));

    if (summary.failedFiles.length > 0) {
      console.log('\n' + chalk.red('❌ 失败详情:'));
      summary.failedFiles.forEach(({ file, error }, index) => {
        console.log(`${index + 1}. ${chalk.yellow(file)}`);
        console.log(`   ${chalk.red('原因:')} ${error}`);
      });
    }
  }

  /**
   * 清理资源
   * @private
   */
  private async _cleanup(): Promise<void> {
    // 清理缓存
    if (this.cache.size > this.cacheSize) {
      const keysToDelete = Array.from(this.cache.keys()).slice(0, this.cache.size - this.cacheSize);
      keysToDelete.forEach(key => this.cache.delete(key));
    }
    
    // 可以添加其他清理逻辑
    this.progress.info('清理完成');
  }

  /**
   * 更新配置
   * @param config 新的配置对象
   */
  updateConfig(config: Partial<Mark2pdfConfig>): void {
    this.config = { ...this.config, ...config };
    this.converter.updateConfig(config);
  }

  /**
   * 获取缓存统计
   * @returns 缓存统计信息
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.cacheSize
    };
  }
}
