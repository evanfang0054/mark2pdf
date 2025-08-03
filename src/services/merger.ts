import path from 'path';
import fs from 'fs/promises';
import { Mark2pdfConfig } from '../config/schema';
import { PdfMerger, MergeResult } from '../core/PdfMerger';
import { ProgressIndicator } from '../utils/progress';
import { getAllFiles, ensureDir } from '../utils/fileUtils';

export interface MergeSummary {
  total: number;
  success: number;
  failed: number;
  duration: number;
  successRate: number;
  failedOperations: Array<{ path: string; error: string }>;
}

/**
 * 合并服务类
 * 负责管理 PDF 文件的批量合并流程
 */
export class MergerService {
  private config: Mark2pdfConfig;
  private merger: PdfMerger;
  private progress: ProgressIndicator;
  private batchSize: number = 1000;

  constructor(config: Mark2pdfConfig, progress: ProgressIndicator) {
    this.config = config;
    this.merger = new PdfMerger(config);
    this.progress = progress;
  }

  /**
   * 执行批量合并
   * @returns Promise<MergeSummary> 合并摘要
   */
  async mergeAll(): Promise<MergeSummary> {
    const startTime = Date.now();
    const results: MergeResult[] = [];
    
    try {
      const inputDir = path.resolve(this.config.input.path);
      const outputDir = path.resolve(this.config.output.path);
      
      await this._ensureOutputDir(outputDir);
      
      this.progress.info('开始扫描 PDF 文件...');
      const directories = await this._scanDirectories(inputDir);
      
      if (directories.length === 0) {
        this.progress.warn('未找到包含 PDF 文件的目录');
        return {
          total: 0,
          success: 0,
          failed: 0,
          duration: 0,
          successRate: 0,
          failedOperations: []
        };
      }

      this.progress.info(`找到 ${directories.length} 个需要处理的目录`);
      
      // 处理每个目录
      for (const dirPath of directories) {
        const result = await this._processDirectory(dirPath, outputDir);
        results.push(result);
      }

      const summary = this._createMergeSummary(results, startTime);
      this._printMergeSummary(summary);
      
      return summary;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.progress.error(`合并过程出错: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 扫描所有包含 PDF 文件的目录
   * @private
   * @param rootDir 根目录
   * @returns 包含 PDF 文件的目录路径数组
   */
  private async _scanDirectories(rootDir: string): Promise<string[]> {
    const directories: string[] = [];
    
    try {
      const result = await getAllFiles(rootDir, '.pdf', true) as { files: string[], subDirs: string[] };
      const { files: pdfFiles, subDirs } = result;
      
      // 如果当前目录有 PDF 文件，添加到列表
      if (pdfFiles.length > 0) {
        directories.push(rootDir);
      }
      
      // 递归扫描子目录
      for (const subDir of subDirs) {
        const subDirectories = await this._scanDirectories(subDir);
        directories.push(...subDirectories);
      }
      
      return directories;
    } catch (error) {
      this.progress.warn(`扫描目录失败 ${rootDir}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 处理单个目录
   * @private
   * @param dirPath 目录路径
   * @param outputDir 输出目录
   * @returns Promise<MergeResult> 处理结果
   */
  private async _processDirectory(dirPath: string, outputDir: string): Promise<MergeResult> {
    try {
      const pdfFiles = await getAllFiles(dirPath, '.pdf', false) as string[];
      
      if (pdfFiles.length === 0) {
        return {
          success: true,
          processedFiles: 0,
          duration: 0
        };
      }

      const folderName = path.basename(dirPath);
      const outputPath = path.join(outputDir, `${folderName}.pdf`);

      if (await this._shouldSkipMerge(outputPath)) {
        this.progress.info(`跳过已存在的文件: ${outputPath}`);
        return {
          success: true,
          outputPath,
          processedFiles: pdfFiles.length,
          duration: 0
        };
      }

      this.progress.info(`正在合并: ${folderName} (${pdfFiles.length} 个文件)`);
      
      const result = await this.merger.merge(pdfFiles, outputPath);
      
      if (result.success) {
        this.progress.info(`✓ ${folderName} 合并完成`);
      } else {
        this.progress.error(`✗ ${folderName} 合并失败: ${result.error}`);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.progress.error(`处理目录失败 ${dirPath}: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        processedFiles: 0,
        duration: 0
      };
    }
  }

  /**
   * 检查是否应该跳过合并
   * @private
   * @param outputPath 输出文件路径
   * @returns 是否应该跳过
   */
  private async _shouldSkipMerge(outputPath: string): Promise<boolean> {
    if (!this.config.options?.overwrite) {
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
   * @param outputDir 输出目录路径
   */
  private async _ensureOutputDir(outputDir: string): Promise<void> {
    if (this.config.output.createDirIfNotExist) {
      await ensureDir(outputDir);
    }
  }

  /**
   * 创建合并摘要
   * @private
   * @param results 合并结果数组
   * @param startTime 开始时间
   * @returns MergeSummary 合并摘要
   */
  private _createMergeSummary(results: MergeResult[], startTime: number): MergeSummary {
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const total = results.length;
    const duration = Date.now() - startTime;
    const successRate = total > 0 ? (success / total) * 100 : 0;
    const failedOperations = results
      .filter(r => !r.success)
      .map(r => ({ 
        path: r.outputPath || '未知路径', 
        error: r.error || '未知错误' 
      }));

    return {
      total,
      success,
      failed,
      duration,
      successRate,
      failedOperations
    };
  }

  /**
   * 打印合并摘要
   * @private
   * @param summary 合并摘要
   */
  private _printMergeSummary(summary: MergeSummary): void {
    const duration = (summary.duration / 1000).toFixed(2);
    
    console.log('\n📊 PDF 合并报告');
    console.log('━'.repeat(50));
    console.log(`总耗时: ${duration} 秒`);
    console.log(`总目录: ${summary.total}`);
    console.log(`成功数: ${summary.success}`);
    console.log(`失败数: ${summary.failed}`);
    console.log(`成功率: ${summary.successRate.toFixed(1)}%`);
    console.log('━'.repeat(50));

    if (summary.failedOperations.length > 0) {
      console.log('\n❌ 失败详情:');
      summary.failedOperations.forEach(({ path, error }, index) => {
        console.log(`${index + 1}. ${path}`);
        console.log(`   原因: ${error}`);
      });
    }
  }

  /**
   * 合并指定的文件列表
   * @param files 文件路径数组
   * @param outputPath 输出路径
   * @returns Promise<MergeResult> 合并结果
   */
  async mergeFiles(files: string[], outputPath: string): Promise<MergeResult> {
    this.progress.info(`开始合并 ${files.length} 个文件`);
    return this.merger.merge(files, outputPath);
  }

  /**
   * 批量处理大文件列表
   * @param files 文件路径数组
   * @param outputDir 输出目录
   * @returns Promise<MergeResult[]> 处理结果数组
   */
  async mergeBatchFiles(files: string[], outputDir: string): Promise<MergeResult[]> {
    const batches = this._splitIntoBatches(files, this.batchSize);
    const results: MergeResult[] = [];
    
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (file, index) => {
          const outputPath = path.join(outputDir, `batch_${Date.now()}_${index}.pdf`);
          return this.mergeFiles([file], outputPath);
        })
      );
      results.push(...batchResults);
      
      // 内存管理
      if (global.gc) {
        global.gc();
      }
    }
    
    return results;
  }

  /**
   * 将文件列表分割成批次
   * @private
   * @param items 文件列表
   * @param size 批次大小
   * @returns 分割后的批次数组
   */
  private _splitIntoBatches<T>(items: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
      items.slice(i * size, (i + 1) * size)
    );
  }

  /**
   * 更新配置
   * @param config 新的配置对象
   */
  updateConfig(config: Partial<Mark2pdfConfig>): void {
    this.config = { ...this.config, ...config };
    this.merger.updateConfig(config);
  }
}
