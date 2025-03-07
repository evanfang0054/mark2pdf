const fs = require('fs').promises;
const { PDFDocument } = require('pdf-lib');
const logger = require('../utils/logger');

/**
 * PDF 合并器类
 * 负责将多个 PDF 文件合并为一个
 */
class PdfMerger {
  /**
   * 创建 PDF 合并器实例
   * @param {Object} config 配置对象
   */
  constructor(config) {
    this.config = config;
    this.compressionOptions = {
      useObjectStreams: config.options.compression.enabled,
      objectsPerStream: this._getCompressionQuality(config.options.compression.quality)
    };
  }

  /**
   * 合并多个 PDF 文件
   * @param {string[]} pdfFiles PDF 文件路径数组
   * @param {string} outputPath 输出文件路径
   * @returns {Promise<boolean>} 合并是否成功
   */
  async merge(pdfFiles, outputPath) {
    try {
      if (pdfFiles.length === 0) {
        logger.warn('没有找到 PDF 文件可合并');
        return false;
      }

      const mergedPdf = await PDFDocument.create();
      const sortedFiles = this._sortFiles(pdfFiles);
      
      await this._mergePdfFiles(mergedPdf, sortedFiles);
      await this._saveMergedPdf(mergedPdf, outputPath);
      
      logger.success(`合并完成: ${outputPath}`);
      return true;
    } catch (error) {
      logger.error('合并失败:', error.message);
      return false;
    }
  }

  /**
   * 对文件进行排序
   * @private
   * @param {string[]} files 文件路径数组
   * @returns {string[]} 排序后的文件路径数组
   */
  _sortFiles(files) {
    if (!this.config.options.sort.enabled) return files;
    
    return files.sort((a, b) => {
      const { method, direction } = this.config.options.sort;
      let result = this._compareFiles(a, b, method);
      return direction === 'desc' ? -result : result;
    });
  }

  /**
   * 比较两个文件
   * @private
   * @param {string} a 第一个文件路径
   * @param {string} b 第二个文件路径
   * @param {string} method 比较方法
   * @returns {number} 比较结果
   */
  _compareFiles(a, b, method) {
    switch (method) {
      case 'name': return a.localeCompare(b);
      case 'date':
        const statsA = fs.statSync(a);
        const statsB = fs.statSync(b);
        return statsA.mtime.getTime() - statsB.mtime.getTime();
      case 'size':
        const sizeA = fs.statSync(a).size;
        const sizeB = fs.statSync(b).size;
        return sizeA - sizeB;
      default: return 0;
    }
  }

  /**
   * 合并 PDF 文件
   * @private
   * @param {PDFDocument} mergedPdf 合并后的 PDF 文档
   * @param {string[]} files 要合并的文件路径数组
   */
  async _mergePdfFiles(mergedPdf, files) {
    for (const pdfPath of files) {
      try {
        const pdfBytes = await fs.readFile(pdfPath);
        const pdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
        logger.success(`成功添加: ${pdfPath}`);
      } catch (error) {
        logger.error(`处理文件失败 ${pdfPath}:`, error.message);
      }
    }
  }

  /**
   * 保存合并后的 PDF
   * @private
   * @param {PDFDocument} mergedPdf 合并后的 PDF 文档
   * @param {string} outputPath 输出文件路径
   */
  async _saveMergedPdf(mergedPdf, outputPath) {
    const mergedPdfBytes = await mergedPdf.save(this.compressionOptions);
    await fs.writeFile(outputPath, mergedPdfBytes);
  }

  /**
   * 获取压缩质量配置
   * @private
   * @param {string} quality 质量级别
   * @returns {number} 压缩质量值
   */
  _getCompressionQuality(quality) {
    const qualityMap = {
      high: 50,
      medium: 20,
      low: 10
    };
    return qualityMap[quality] || qualityMap.medium;
  }
}

module.exports = PdfMerger; 