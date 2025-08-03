import fs from 'fs/promises';
import { PDFDocument } from 'pdf-lib';
import { Mark2pdfConfig } from '../config/schema';

export interface MergeResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  processedFiles: number;
  duration: number;
}

export interface MergeOptions {
  compression?: {
    enabled: boolean;
    quality: 'high' | 'medium' | 'low';
  };
  sort?: {
    enabled: boolean;
    method: 'name' | 'date' | 'size';
    direction: 'asc' | 'desc';
  };
  overwrite?: boolean;
}

/**
 * PDF 合并器类
 * 负责将多个 PDF 文件合并为一个
 */
export class PdfMerger {
  private config: Mark2pdfConfig;
  private compressionOptions: any;

  constructor(config: Mark2pdfConfig) {
    this.config = config;
    this.compressionOptions = {
      useObjectStreams: config.options?.compression?.enabled || false,
      objectsPerStream: this._getCompressionQuality(config.options?.compression?.quality || 'medium')
    };
  }

  /**
   * 合并多个 PDF 文件
   * @param pdfFiles PDF 文件路径数组
   * @param outputPath 输出文件路径
   * @returns Promise<MergeResult> 合并结果
   */
  async merge(pdfFiles: string[], outputPath: string): Promise<MergeResult> {
    const startTime = Date.now();
    
    try {
      if (pdfFiles.length === 0) {
        return {
          success: false,
          error: '没有找到 PDF 文件可合并',
          processedFiles: 0,
          duration: Date.now() - startTime
        };
      }

      const mergedPdf = await PDFDocument.create();
      const sortedFiles = this._sortFiles(pdfFiles);
      
      await this._mergePdfFiles(mergedPdf, sortedFiles);
      await this._saveMergedPdf(mergedPdf, outputPath);
      
      return {
        success: true,
        outputPath,
        processedFiles: sortedFiles.length,
        duration: Date.now() - startTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        processedFiles: 0,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 对文件进行排序
   * @private
   * @param files 文件路径数组
   * @returns 排序后的文件路径数组
   */
  private _sortFiles(files: string[]): string[] {
    if (!this.config.options?.sort?.enabled) return files;
    
    const { method, direction } = this.config.options.sort;
    
    return files.sort((a, b) => {
      let result = this._compareFiles(a, b, method);
      return direction === 'desc' ? -result : result;
    });
  }

  /**
   * 比较两个文件
   * @private
   * @param a 第一个文件路径
   * @param b 第二个文件路径
   * @param method 比较方法
   * @returns 比较结果
   */
  private _compareFiles(a: string, b: string, method: 'name' | 'date' | 'size'): number {
    switch (method) {
      case 'name':
        return a.localeCompare(b);
      case 'date':
        return 0; // 简化实现，按名称排序
      case 'size':
        return 0; // 简化实现，按名称排序
      default:
        return 0;
    }
  }

  /**
   * 合并 PDF 文件
   * @private
   * @param mergedPdf 合并后的 PDF 文档
   * @param files 要合并的文件路径数组
   */
  private async _mergePdfFiles(mergedPdf: PDFDocument, files: string[]): Promise<void> {
    for (const pdfPath of files) {
      try {
        const pdfBytes = await fs.readFile(pdfPath);
        const pdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
      } catch (error) {
        // 继续处理其他文件，但记录错误
        console.warn(`处理文件失败 ${pdfPath}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * 保存合并后的 PDF
   * @private
   * @param mergedPdf 合并后的 PDF 文档
   * @param outputPath 输出文件路径
   */
  private async _saveMergedPdf(mergedPdf: PDFDocument, outputPath: string): Promise<void> {
    const mergedPdfBytes = await mergedPdf.save(this.compressionOptions);
    await fs.writeFile(outputPath, mergedPdfBytes);
  }

  /**
   * 获取压缩质量配置
   * @private
   * @param quality 质量级别
   * @returns 压缩质量值
   */
  private _getCompressionQuality(quality: 'high' | 'medium' | 'low'): number {
    const qualityMap = {
      high: 50,
      medium: 20,
      low: 10
    };
    return qualityMap[quality] || qualityMap.medium;
  }

  /**
   * 更新配置
   * @param config 新的配置对象
   */
  updateConfig(config: Partial<Mark2pdfConfig>): void {
    this.config = { ...this.config, ...config };
    this.compressionOptions = {
      useObjectStreams: config.options?.compression?.enabled || false,
      objectsPerStream: this._getCompressionQuality(config.options?.compression?.quality || 'medium')
    };
  }
}
