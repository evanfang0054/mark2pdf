import fs from 'fs/promises';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { OutputFormatter, OutputFormat, ContentMetadata } from '../utils/outputFormatter';

/**
 * 提取结果
 */
export interface PdfExtractionResult {
  success: boolean;
  file: string;
  output?: string;
  content?: string;
  error?: string;
  duration: number;
  pageCount?: number;
}

/**
 * 提取选项
 */
export interface PdfExtractOptions {
  format?: OutputFormat;
  outputDir?: string;
  cleanText?: boolean;
  preserveStructure?: boolean;
}

/**
 * 结构化内容
 */
export interface StructuredContent {
  title?: string;
  pages: string[];
  metadata: {
    pageCount: number;
    wordCount: number;
  };
}

/**
 * PDF 文本提取器
 * 使用 pdf-parse v2 库从 PDF 文件中提取文本内容
 */
export class PdfExtractor {
  private options: Required<PdfExtractOptions>;

  constructor(options: PdfExtractOptions = {}) {
    this.options = {
      format: options.format || 'txt',
      outputDir: options.outputDir || './output',
      cleanText: options.cleanText ?? true,
      preserveStructure: options.preserveStructure ?? false,
    };
  }

  /**
   * 从 PDF 提取纯文本
   * @param filePath PDF 文件路径
   */
  async extractText(filePath: string): Promise<string> {
    const data = await fs.readFile(filePath);
    const parser = new PDFParse({ data });
    const result = await parser.getText();

    let text = result.text;

    if (this.options.cleanText) {
      text = OutputFormatter.cleanText(text);
    }

    return text;
  }

  /**
   * 从 PDF 提取结构化内容
   * @param filePath PDF 文件路径
   */
  async extractStructured(filePath: string): Promise<StructuredContent> {
    const data = await fs.readFile(filePath);
    const parser = new PDFParse({ data });
    const result = await parser.getText();

    // pdf-parse v2 返回 TextResult，包含 text 属性
    // 页数估计（pdf-parse v2 可能不直接提供页数）
    const pageCount = 1; // 默认值

    // 清理文本
    const cleanedText = this.options.cleanText
      ? OutputFormatter.cleanText(result.text)
      : result.text;

    return {
      title: this._extractTitle(filePath, cleanedText),
      pages: [cleanedText],
      metadata: {
        pageCount,
        wordCount: OutputFormatter.countWords(cleanedText),
      },
    };
  }

  /**
   * 提取单个文件
   * @param filePath 输入文件路径
   * @param outputDir 输出目录（可选）
   */
  async extract(filePath: string, outputDir?: string): Promise<PdfExtractionResult> {
    const startTime = Date.now();
    const targetDir = outputDir || this.options.outputDir;

    try {
      // 提取内容
      const content = await this.extractText(filePath);
      const structured = await this.extractStructured(filePath);

      // 准备元数据
      const metadata: ContentMetadata = {
        title: structured.title,
        source: filePath,
        wordCount: structured.metadata.wordCount,
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
        pageCount: structured.metadata.pageCount,
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
   * 批量提取文件
   * @param files 文件路径数组
   * @param outputDir 输出目录
   */
  async extractBatch(files: string[], outputDir?: string): Promise<PdfExtractionResult[]> {
    const results: PdfExtractionResult[] = [];
    const targetDir = outputDir || this.options.outputDir;

    // 确保输出目录存在
    await fs.mkdir(targetDir, { recursive: true });

    for (const file of files) {
      const result = await this.extract(file, targetDir);
      results.push(result);
    }

    return results;
  }

  /**
   * 计算输出路径
   * @private
   */
  private _getOutputPath(inputPath: string, outputDir: string, format: OutputFormat): string {
    const basename = path.basename(inputPath, '.pdf');
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
      return firstLine;
    }
    // 回退到文件名
    return path.basename(filePath, '.pdf');
  }

  /**
   * 更新选项
   */
  updateOptions(options: Partial<PdfExtractOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
