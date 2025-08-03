import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import PDFDocument from 'pdfkit';
import { Mark2pdfConfig } from '../config/schema';
import { ensureDir, isMarkdownFile } from '../utils/fileUtils';
import { getOutputPath } from '../utils/pathUtils';
import { ProgressIndicator } from '../utils/progress';

// Markdown 解析器
import { marked } from 'marked';

export interface ConversionResult {
  success: boolean;
  file: string;
  output?: string;
  error?: string;
  duration: number;
}

/**
 * PDF 转换器类
 * 负责将 Markdown 文件转换为 PDF（使用 pdfkit）
 */
export class PdfConverter {
  private config: Mark2pdfConfig;
  private progress?: ProgressIndicator;

  constructor(config: Mark2pdfConfig, progress?: ProgressIndicator) {
    this.config = config;
    this.progress = progress;
  }

  /**
   * 转换单个 Markdown 文件为 PDF
   * @param mdFile Markdown 文件路径
   * @returns Promise<ConversionResult> 转换结果
   */
  async convert(mdFile: string): Promise<ConversionResult> {
    const outputPath = getOutputPath(mdFile, this.config);
    const startTime = Date.now();
    
    try {
      if (this.progress) {
        this.progress.info(`开始转换: ${path.basename(mdFile)}`);
      }

      await this._validateAndPrepare(mdFile, outputPath);
      await this._performConversion(mdFile, outputPath);
      
      const duration = Date.now() - startTime;
      
      if (this.progress) {
        this.progress.info(`✓ ${path.basename(mdFile)} (${duration}ms)`);
      }
      
      return {
        success: true,
        file: mdFile,
        output: outputPath,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.progress) {
        this.progress.error(`转换失败 ${path.basename(mdFile)}: ${errorMessage}`);
      }
      
      return {
        success: false,
        file: mdFile,
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * 批量转换多个 Markdown 文件
   * @param mdFiles Markdown 文件路径数组
   * @returns Promise<ConversionResult[]> 转换结果数组
   */
  async convertBatch(mdFiles: string[]): Promise<ConversionResult[]> {
    if (this.progress) {
      this.progress.start(mdFiles.length);
    }

    const results: ConversionResult[] = [];
    const batchSize = this.config.options.concurrent;

    for (let i = 0; i < mdFiles.length; i += batchSize) {
      const batch = mdFiles.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          const result = await this.convert(file);
          if (this.progress) {
            this.progress.update(file);
          }
          return result;
        })
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 验证输入文件并准备输出目录
   * @private
   * @param mdFile Markdown 文件路径
   * @param outputPath 输出文件路径
   */
  private async _validateAndPrepare(mdFile: string, outputPath: string): Promise<void> {
    if (!isMarkdownFile(mdFile)) {
      throw new Error('不是有效的 Markdown 文件');
    }

    const [content] = await Promise.all([
      fsPromises.readFile(mdFile, 'utf-8'),
      ensureDir(path.dirname(outputPath))
    ]);

    if (!content.trim()) {
      throw new Error('文件内容为空');
    }
  }

  /**
   * 执行转换操作
   * @private
   * @param mdFile Markdown 文件路径
   * @param outputPath 输出文件路径
   * @returns Promise<void>
   */
  private async _performConversion(mdFile: string, outputPath: string): Promise<void> {
    const absoluteMdFile = path.resolve(mdFile);
    const absoluteOutputPath = path.resolve(outputPath);
    
    // 读取 Markdown 文件内容
    const markdownContent = await fsPromises.readFile(absoluteMdFile, 'utf-8');
    
    // 将 Markdown 转换为 HTML
    const htmlContent = marked(markdownContent) as string;
    
    // 使用改进的 PDF 生成方法
    await this._generatePdfWithChineseSupport(absoluteOutputPath, htmlContent);
  }

  /**
   * 生成支持中文的 PDF
   * @private
   * @param outputPath 输出文件路径
   * @param htmlContent HTML 内容
   */
  private async _generatePdfWithChineseSupport(outputPath: string, htmlContent: string): Promise<void> {
    // 创建 PDF 文档
    const doc = new PDFDocument({
      margin: 50,
      size: this.config.options.format || 'A4'
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // 尝试使用支持中文的字体
    const fontInfo = this._getChineseFontInfo();
    if (fontInfo) {
      try {
        if (fontInfo.fontName) {
          // .ttc 文件需要指定字体名称
          doc.font(fontInfo.fontPath, fontInfo.fontName);
        } else {
          // .ttf 文件直接使用
          doc.font(fontInfo.fontPath);
        }
      } catch (error) {
        console.warn('中文字体加载失败，使用 Helvetica:', error);
        doc.font('Helvetica');
      }
    } else {
      // 如果没有中文字体，使用 Helvetica 并警告
      doc.font('Helvetica');
      console.warn('未找到支持中文的字体文件，中文内容可能显示为乱码');
    }

    // 解析 HTML 内容并渲染到 PDF
    await this._renderHtmlToPdfWithSimpleText(doc, htmlContent);

    // 结束文档
    doc.end();

    // 等待写入完成
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  /**
   * 获取中文字体文件路径和字体名称
   * @private
   * @returns {fontPath: string, fontName?: string} | null
   */
  private _getChineseFontInfo(): {fontPath: string, fontName?: string} | null {
    // 尝试多个可能的中文字体路径
    const fontConfigs = [
      // 项目内的字体文件
      { path: path.join(process.cwd(), 'assets/fonts', 'SimHei.ttf') },
      { path: path.join(process.cwd(), 'assets/fonts', 'MicrosoftYaHei.ttf') },
      { path: path.join(process.cwd(), 'assets/fonts', 'PingFang.ttf') },
      
      // macOS 系统字体 - .ttc 文件需要指定字体名称
      { path: '/System/Library/Fonts/PingFang.ttc', name: 'PingFangSC-Regular' },
      { path: '/System/Library/Fonts/Hiragino Sans GB.ttc', name: 'HiraginoSansGB-W3' },
      { path: '/System/Library/Fonts/STHeiti Light.ttc', name: 'STHeiti-Light' },
      
      // macOS 系统 .ttf 字体
      { path: '/System/Library/Fonts/Arial Unicode.ttf' },
      { path: '/System/Library/Fonts/Supplemental/Arial Unicode.ttf' },
      
      // Windows 系统字体（在 macOS 上不存在，但保留以供参考）
      { path: 'C:/Windows/Fonts/msyh.ttf' },
      { path: 'C:/Windows/Fonts/simhei.ttf' },
      { path: 'C:/Windows/Fonts/arialuni.ttf' },
      
      // Linux 系统字体
      { path: '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc' },
      { path: '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc' },
    ];

    for (const config of fontConfigs) {
      if (fs.existsSync(config.path)) {
        console.log(`使用中文字体: ${config.path}${config.name ? ` (${config.name})` : ''}`);
        return { fontPath: config.path, fontName: config.name };
      }
    }

    return null;
  }

  /**
   * 使用简单文本方式渲染 HTML 内容（支持中文）
   * @private
   * @param doc PDFKit 文档对象
   * @param htmlContent HTML 内容
   */
  private async _renderHtmlToPdfWithSimpleText(doc: any, htmlContent: string): Promise<void> {
    // 提取纯文本内容
    const textContent = this._extractTextFromHtml(htmlContent);
    
    // 渲染文本到 PDF
    doc.fontSize(12)
       .fillColor('#2d3748')
       .text(textContent, { continued: false });
  }

  /**
   * 从 HTML 中提取纯文本内容
   * @private
   * @param htmlContent HTML 内容
   * @returns 纯文本内容
   */
  private _extractTextFromHtml(htmlContent: string): string {
    // 先解码 HTML 实体
    let decodedContent = this._decodeHtmlEntities(htmlContent);
    
    // 移除 HTML 标签，保留文本内容
    return decodedContent
      .replace(/<h1[^>]*>/gi, '\n\n=== ')
      .replace(/<\/h1>/gi, ' ===\n\n')
      .replace(/<h2[^>]*>/gi, '\n\n--- ')
      .replace(/<\/h2>/gi, ' ---\n\n')
      .replace(/<h3[^>]*>/gi, '\n\n• ')
      .replace(/<\/h3>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<blockquote[^>]*>/gi, '\n「')
      .replace(/<\/blockquote>/gi, '」\n')
      .replace(/<pre[^>]*>/gi, '\n```\n')
      .replace(/<code[^>]*>/gi, '`')
      .replace(/<\/code>/gi, '`')
      .replace(/<\/pre>/gi, '\n```\n')
      .replace(/<[^>]*>/g, '') // 移除其他 HTML 标签
      .replace(/\n{3,}/g, '\n\n') // 合并多个换行
      .trim();
  }

  /**
   * 解码 HTML 实体
   * @private
   * @param htmlContent 包含 HTML 实体的内容
   * @returns 解码后的内容
   */
  private _decodeHtmlEntities(htmlContent: string): string {
    // 先解码十六进制实体，如 &#x1F600;
    const hexEntityRegex = /&#x([0-9A-Fa-f]+);/gi;
    htmlContent = htmlContent.replace(hexEntityRegex, (match, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return match;
      }
    });

    // 再解码十进制实体，如 &#128512;
    const decEntityRegex = /&#(\d+);/gi;
    htmlContent = htmlContent.replace(decEntityRegex, (match, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return match;
      }
    });

    // 解码常用命名实体（大小写不敏感）
    return htmlContent
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&nbsp;/gi, ' ') // 非断空格
      .replace(/&copy;/gi, '©')
      .replace(/&reg;/gi, '®')
      .replace(/&trade;/gi, '™')
      .replace(/&euro;/gi, '€')
      .replace(/&pound;/gi, '£')
      .replace(/&yen;/gi, '¥')
      .replace(/&deg;/gi, '°') // 度数符号
      .replace(/&plusmn;/gi, '±') // 正负号
      .replace(/&times;/gi, '×') // 乘号
      .replace(/&divide;/gi, '÷'); // 除号
  }

  
  /**
   * 更新配置
   * @param config 新的配置对象
   */
  updateConfig(config: Partial<Mark2pdfConfig>): void {
    this.config = { ...this.config, ...config };
  }
}