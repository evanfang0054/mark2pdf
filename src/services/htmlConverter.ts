import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import PDFDocument from 'pdfkit';
import { ProgressIndicator } from '../utils/progress';
import { getAllFiles, ensureDir } from '../utils/fileUtils';

export interface HtmlConversionResult {
  success: boolean;
  file: string;
  output?: string;
  error?: string;
  duration: number;
}

export interface HtmlConversionSummary {
  total: number;
  success: number;
  failed: number;
  duration: number;
  failedFiles: Array<{ file: string; error: string }>;
}

export interface HtmlConverterOptions {
  format?: 'A4' | 'A3' | 'A5' | 'Letter';
  margin?: number;
  fontSize?: number;
}

/**
 * HTML 转 PDF 服务（轻量级实现）
 * 支持基本 HTML 元素渲染：标题、段落、列表、代码块、表格
 */
export class HtmlConverterService {
  private progress: ProgressIndicator;
  private options: Required<HtmlConverterOptions>;

  constructor(progress: ProgressIndicator, options: HtmlConverterOptions = {}) {
    this.progress = progress;
    this.options = {
      format: options.format || 'A4',
      margin: options.margin || 50,
      fontSize: options.fontSize || 12
    };
  }

  async convertAll(inputPath: string, outputPath: string): Promise<HtmlConversionSummary> {
    const startTime = Date.now();

    // 扫描 HTML 文件
    this.progress.info('正在扫描 HTML 文件...');
    const htmlFiles = await getAllFiles(inputPath, '.html') as string[];
    return this.convertFiles(htmlFiles, inputPath, outputPath, startTime, false);
  }

  async convertFiles(
    htmlFiles: string[],
    inputBase: string,
    outputBase: string,
    startTime: number = Date.now(),
    logScanResult: boolean = true
  ): Promise<HtmlConversionSummary> {
    const results: HtmlConversionResult[] = [];

    if (htmlFiles.length === 0) {
      this.progress.warn('未找到任何 HTML 文件');
      return { total: 0, success: 0, failed: 0, duration: 0, failedFiles: [] };
    }

    if (logScanResult) {
      this.progress.info(`找到 ${chalk.cyan(htmlFiles.length.toString())} 个 HTML 文件`);
    }

    // 确保输出目录存在
    await ensureDir(outputBase);

    // 转换所有文件
    for (const htmlFile of htmlFiles) {
      const result = await this.convertFile(htmlFile, inputBase, outputBase);
      results.push(result);
    }

    // 生成报告
    const summary = this._createSummary(results, startTime);
    this._printSummary(summary);
    return summary;
  }

  private async convertFile(
    htmlFile: string,
    inputBase: string,
    outputBase: string
  ): Promise<HtmlConversionResult> {
    const startTime = Date.now();
    const fileName = path.basename(htmlFile);

    try {
      // 计算输出路径
      const relativePath = path.relative(inputBase, htmlFile);
      const outputDir = path.join(outputBase, path.dirname(relativePath));
      await ensureDir(outputDir);
      const outputPath = path.join(outputDir, fileName.replace(/\.html?$/i, '.pdf'));

      this.progress.info(`正在转换: ${fileName}`);

      // 读取 HTML 内容
      const htmlContent = fs.readFileSync(htmlFile, 'utf-8');

      // 创建 PDF
      await this._renderHtmlToPdf(htmlContent, outputPath);

      const duration = Date.now() - startTime;
      this.progress.info(`✓ ${fileName} (${duration}ms)`);

      return { success: true, file: htmlFile, output: outputPath, duration };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.progress.error(`✗ ${fileName}: ${errorMessage}`);
      return { success: false, file: htmlFile, error: errorMessage, duration };
    }
  }

  /**
   * 渲染 HTML 到 PDF（支持基本样式）
   */
  private async _renderHtmlToPdf(htmlContent: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: this.options.margin,
          size: this.options.format
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // 设置中文字体
        this._setupChineseFont(doc);

        // 解析并渲染 HTML
        const elements = this._parseHtml(htmlContent);
        this._renderElements(doc, elements);

        doc.end();

        stream.on('finish', resolve);
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 设置中文字体
   */
  private _setupChineseFont(doc: PDFKit.PDFDocument): void {
    const fontPaths = [
      '/System/Library/Fonts/PingFang.ttc',
      '/System/Library/Fonts/Hiragino Sans GB.ttc',
      'C:/Windows/Fonts/msyh.ttf',
      '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc'
    ];

    for (const fontPath of fontPaths) {
      if (fs.existsSync(fontPath)) {
        try {
          if (fontPath.endsWith('.ttc')) {
            doc.font(fontPath, 'PingFangSC-Regular');
          } else {
            doc.font(fontPath);
          }
          return;
        } catch {
          continue;
        }
      }
    }
    doc.font('Helvetica');
  }

  /**
   * 解析 HTML 提取结构化元素
   */
  private _parseHtml(html: string): ParsedElement[] {
    const elements: ParsedElement[] = [];

    // 移除 style 和 script 标签内容
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // 解析标题
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
    let match;
    while ((match = headingRegex.exec(html)) !== null) {
      elements.push({
        type: 'heading',
        level: parseInt(match[1]),
        text: this._cleanText(match[2])
      });
    }

    // 解析段落
    const paraRegex = /<p[^>]*>(.*?)<\/p>/gis;
    while ((match = paraRegex.exec(html)) !== null) {
      const text = this._cleanText(match[1]);
      if (text.trim()) {
        elements.push({ type: 'paragraph', text });
      }
    }

    // 解析列表项
    const liRegex = /<li[^>]*>(.*?)<\/li>/gis;
    while ((match = liRegex.exec(html)) !== null) {
      elements.push({
        type: 'listItem',
        text: this._cleanText(match[1])
      });
    }

    // 解析代码块
    const codeRegex = /<(?:pre|code)[^>]*>(.*?)<\/(?:pre|code)>/gis;
    while ((match = codeRegex.exec(html)) !== null) {
      elements.push({
        type: 'code',
        text: this._cleanText(match[1])
      });
    }

    // 如果没有解析到任何元素，提取纯文本
    if (elements.length === 0) {
      const text = this._cleanText(html);
      if (text.trim()) {
        elements.push({ type: 'paragraph', text });
      }
    }

    return elements;
  }

  /**
   * 渲染元素到 PDF
   */
  private _renderElements(doc: PDFKit.PDFDocument, elements: ParsedElement[]): void {
    for (const el of elements) {
      switch (el.type) {
        case 'heading':
          const sizes = [24, 20, 18, 16, 14, 12];
          const level = el.level ?? 1;
          doc.fontSize(sizes[level - 1] || 12)
             .fillColor('#1a202c')
             .font('Helvetica-Bold')
             .text(el.text, { continued: false })
             .moveDown(0.5);
          break;

        case 'paragraph':
          doc.fontSize(this.options.fontSize)
             .fillColor('#2d3748')
             .font('Helvetica')
             .text(el.text, { continued: false })
             .moveDown(0.3);
          break;

        case 'listItem':
          doc.fontSize(this.options.fontSize)
             .fillColor('#2d3748')
             .text(`• ${el.text}`, { indent: 20, continued: false })
             .moveDown(0.2);
          break;

        case 'code':
          doc.fontSize(10)
             .fillColor('#e53e3e')
             .font('Courier')
             .text(el.text, { indent: 20, continued: false })
             .moveDown(0.3);
          break;
      }
    }
  }

  /**
   * 清理 HTML 标签和实体
   */
  private _cleanText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\s+/g, ' ')
      .trim();
  }

  private _createSummary(results: HtmlConversionResult[], startTime: number): HtmlConversionSummary {
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success);
    return {
      total: results.length,
      success,
      failed: failed.length,
      duration: Date.now() - startTime,
      failedFiles: failed.map(r => ({ file: r.file, error: r.error || '未知错误' }))
    };
  }

  private _printSummary(summary: HtmlConversionSummary): void {
    const duration = (summary.duration / 1000).toFixed(2);

    console.log('');
    console.log(chalk.gray('═'.repeat(50)));
    console.log(chalk.bold.cyan('📋 HTML 转 PDF 报告'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(`  总计: ${chalk.white(summary.total.toString())} 个文件`);
    console.log(`  成功: ${chalk.green(summary.success.toString())} 个`);
    console.log(`  失败: ${summary.failed > 0 ? chalk.red(summary.failed.toString()) : chalk.gray('0')} 个`);
    console.log(`  耗时: ${chalk.cyan(duration)}s`);

    if (summary.failedFiles.length > 0) {
      console.log('');
      console.log(chalk.red('❌ 失败文件:'));
      summary.failedFiles.forEach(({ file, error }, index) => {
        const fileName = file.split('/').pop() || file;
        console.log(`  ${chalk.gray((index + 1).toString().padStart(2, ' ') + '.')} ${chalk.yellow(fileName)}`);
        console.log(`     ${chalk.gray('→')} ${chalk.red(error)}`);
      });
    }
    console.log(chalk.gray('═'.repeat(50)));
  }
}

interface ParsedElement {
  type: 'heading' | 'paragraph' | 'listItem' | 'code';
  level?: number;
  text: string;
}
