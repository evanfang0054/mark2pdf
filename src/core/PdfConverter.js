const fs = require('fs').promises;
const path = require('path');
const markdownpdf = require('markdown-pdf');
const { ensureDir, isMarkdownFile } = require('../utils/fileUtils');
const { getOutputPath } = require('../utils/pathUtils');
const logger = require('../utils/logger');

/**
 * PDF 转换器类
 * 负责将 Markdown 文件转换为 PDF
 */
class PdfConverter {
  /**
   * 创建 PDF 转换器实例
   * @param {Object} config 配置对象
   */
  constructor(config) {
    this.config = config;
    this.pdfOptions = {
      remarkable: {
        breaks: true,
        typographer: true,
        html: true,
      },
      paperFormat: config.options.format,
      paperOrientation: config.options.orientation,
      renderDelay: 1000,
      timeout: config.options.timeout,
      cssPath: this._getCustomCssPath(),
    };
  }

  /**
   * 转换单个 Markdown 文件为 PDF
   * @param {string} mdFile Markdown 文件路径
   * @returns {Promise<Object>} 转换结果
   */
  async convert(mdFile) {
    const outputPath = getOutputPath(mdFile, this.config);
    const startTime = Date.now();
    
    try {
      await this._validateAndPrepare(mdFile, outputPath);
      await this._performConversion(mdFile, outputPath);
      
      const duration = Date.now() - startTime;
      logger.info(`✓ ${path.basename(mdFile)} (${duration}ms)`);
      
      return {
        success: true,
        file: mdFile,
        output: outputPath,
        duration
      };
    } catch (error) {
      logger.error(`转换失败 ${path.basename(mdFile)}:`, error.message);
      return {
        success: false,
        file: mdFile,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 验证输入文件
   * @private
   * @param {string} mdFile Markdown 文件路径
   * @param {string} outputPath 输出文件路径
   */
  async _validateAndPrepare(mdFile, outputPath) {
    if (!isMarkdownFile(mdFile)) {
      throw new Error('不是有效的 Markdown 文件');
    }

    const [content, outputDir] = await Promise.all([
      fs.readFile(mdFile, 'utf-8'),
      ensureDir(path.dirname(outputPath))
    ]);

    if (!content.trim()) {
      throw new Error('文件内容为空');
    }
  }

  /**
   * 执行转换操作
   * @private
   * @param {string} mdFile Markdown 文件路径
   * @param {string} outputPath 输出文件路径
   * @returns {Promise<void>}
   */
  async _performConversion(mdFile, outputPath) {
    return new Promise((resolve, reject) => {
      markdownpdf(this.pdfOptions)
        .from(mdFile)
        .to(outputPath, (err) => {
          if (err) reject(err);
          else resolve();
        });
    });
  }

  /**
   * 获取自定义 CSS 文件路径
   * @private
   * @returns {string} CSS 文件路径
   */
  _getCustomCssPath() {
    return path.join(process.cwd(), 'assets', 'pdf-style.css');
  }
}

module.exports = PdfConverter; 