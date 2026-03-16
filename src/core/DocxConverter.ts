import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import { OutputFormatter, OutputFormat, ContentMetadata } from '../utils/outputFormatter';

/**
 * 转换结果
 */
export interface DocxConversionResult {
  success: boolean;
  file: string;
  output?: string;
  content?: string;
  error?: string;
  duration: number;
}

/**
 * 转换选项
 */
export interface DocxConvertOptions {
  format?: OutputFormat;
  outputDir?: string;
  preserveStructure?: boolean;
}

/**
 * Word 文档转换器
 * 使用 mammoth 库将 .docx 文件转换为各种格式
 */
export class DocxConverter {
  private options: Required<DocxConvertOptions>;

  constructor(options: DocxConvertOptions = {}) {
    this.options = {
      format: options.format || 'txt',
      outputDir: options.outputDir || './output',
      preserveStructure: options.preserveStructure ?? true,
    };
  }

  /**
   * 从 Word 文档提取纯文本
   * @param filePath .docx 文件路径
   */
  async extractText(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  /**
   * 从 Word 文档提取 HTML
   * @param filePath .docx 文件路径
   */
  async extractHtml(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.convertToHtml({ buffer });
    return result.value;
  }

  /**
   * 从 Word 文档提取 Markdown（简化实现）
   * @param filePath .docx 文件路径
   */
  async extractMarkdown(filePath: string): Promise<string> {
    // mammoth 不直接支持 markdown，使用 HTML 转 Markdown
    const html = await this.extractHtml(filePath);
    return this._htmlToMarkdown(html);
  }

  /**
   * 简单的 HTML 转 Markdown
   * @private
   */
  private _htmlToMarkdown(html: string): string {
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * 转换单个文件
   * @param filePath 输入文件路径
   * @param outputDir 输出目录（可选，覆盖默认值）
   */
  async convert(filePath: string, outputDir?: string): Promise<DocxConversionResult> {
    const startTime = Date.now();
    const targetDir = outputDir || this.options.outputDir;

    try {
      // 提取内容
      const content = await this.extractText(filePath);
      const title = this._extractTitle(filePath, content);

      // 准备元数据
      const metadata: ContentMetadata = {
        title,
        source: filePath,
        wordCount: OutputFormatter.countWords(content),
      };

      // 格式化输出
      const formatted = OutputFormatter.format(content, this.options.format, metadata);

      // 计算输出路径
      const outputPath = this._getOutputPath(filePath, targetDir, this.options.format);

      // 确保输出目录存在
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // 写入文件
      if (typeof formatted.content === 'string') {
        await fs.writeFile(outputPath, formatted.content, 'utf-8');
      } else {
        await fs.writeFile(outputPath, formatted.content);
      }

      return {
        success: true,
        file: filePath,
        output: outputPath,
        content,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 批量转换文件
   * @param files 文件路径数组
   * @param outputDir 输出目录
   */
  async convertBatch(files: string[], outputDir?: string): Promise<DocxConversionResult[]> {
    const results: DocxConversionResult[] = [];
    const targetDir = outputDir || this.options.outputDir;

    // 确保输出目录存在
    await fs.mkdir(targetDir, { recursive: true });

    for (const file of files) {
      const result = await this.convert(file, targetDir);
      results.push(result);
    }

    return results;
  }

  /**
   * 计算输出路径
   * @private
   */
  private _getOutputPath(inputPath: string, outputDir: string, format: OutputFormat): string {
    const basename = path.basename(inputPath, '.docx');
    const ext = OutputFormatter.getExtension(format);
    return path.join(outputDir, `${basename}${ext}`);
  }

  /**
   * 从文件名或内容中提取标题
   * @private
   */
  private _extractTitle(filePath: string, content: string): string {
    // 尝试从内容第一行提取标题
    const firstLine = content.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 100 && firstLine.length > 0) {
      return firstLine.replace(/^#+\s*/, ''); // 移除 Markdown 标题符号
    }
    // 回退到文件名
    return path.basename(filePath, '.docx');
  }

  /**
   * 更新选项
   */
  updateOptions(options: Partial<DocxConvertOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
