/**
 * 支持的输出格式
 */
export type OutputFormat = 'pdf' | 'txt' | 'md' | 'json';

/**
 * 内容元数据
 */
export interface ContentMetadata {
  title?: string;
  source?: string;
  wordCount?: number;
  sections?: ContentSection[];
}

/**
 * 内容章节
 */
export interface ContentSection {
  level: number;
  title: string;
  content: string;
}

/**
 * 格式化后的输出
 */
export interface FormattedOutput {
  content: string | Buffer;
  extension: string;
  mimeType: string;
}

/**
 * 输出格式化器
 */
export class OutputFormatter {
  /**
   * 格式化内容
   * @param content 原始文本内容
   * @param format 目标格式
   * @param metadata 可选元数据
   */
  static format(content: string, format: OutputFormat, metadata?: ContentMetadata): FormattedOutput {
    switch (format) {
      case 'txt':
        return this.toText(content);
      case 'md':
        return this.toMarkdown(content, metadata);
      case 'json':
        return this.toJson(content, metadata);
      case 'pdf':
        // PDF 需要在外部处理，这里返回原始内容
        return { content, extension: '.pdf', mimeType: 'application/pdf' };
      default:
        return this.toText(content);
    }
  }

  /**
   * 转换为纯文本
   */
  private static toText(content: string): FormattedOutput {
    return {
      content: this.cleanText(content),
      extension: '.txt',
      mimeType: 'text/plain',
    };
  }

  /**
   * 转换为 Markdown
   */
  private static toMarkdown(content: string, metadata?: ContentMetadata): FormattedOutput {
    let md = '';

    // 添加标题
    if (metadata?.title) {
      md += `# ${metadata.title}\n\n`;
    }

    // 添加来源信息
    if (metadata?.source) {
      md += `> 来源: ${metadata.source}\n\n`;
    }

    // 添加正文
    md += this.cleanText(content);

    // 添加元数据
    if (metadata?.wordCount) {
      md += `\n\n---\n字数: ${metadata.wordCount}`;
    }

    return {
      content: md,
      extension: '.md',
      mimeType: 'text/markdown',
    };
  }

  /**
   * 转换为 JSON
   */
  private static toJson(content: string, metadata?: ContentMetadata): FormattedOutput {
    const json = {
      title: metadata?.title || '',
      source: metadata?.source || '',
      wordCount: metadata?.wordCount || this.countWords(content),
      sections: metadata?.sections || [],
      content: this.cleanText(content),
      extractedAt: new Date().toISOString(),
    };

    return {
      content: JSON.stringify(json, null, 2),
      extension: '.json',
      mimeType: 'application/json',
    };
  }

  /**
   * 清理文本（去除多余空白和换行）
   */
  static cleanText(content: string): string {
    return content
      .replace(/\r\n/g, '\n')           // 统一换行符
      .replace(/\n{3,}/g, '\n\n')       // 合并多余空行
      .replace(/[ \t]+/g, ' ')          // 合并多余空格
      .replace(/^ +| +$/gm, '')         // 去除行首行尾空格
      .trim();
  }

  /**
   * 计算字数
   */
  static countWords(content: string): number {
    // 中文按字符数，英文按单词数
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  }

  /**
   * 根据文件路径推断输出格式
   * @param outputPath 输出路径
   */
  static inferFormat(outputPath: string): OutputFormat {
    const ext = outputPath.toLowerCase().split('.').pop();
    const formatMap: Record<string, OutputFormat> = {
      txt: 'txt',
      md: 'md',
      json: 'json',
      pdf: 'pdf',
    };
    return formatMap[ext || ''] || 'pdf';
  }

  /**
   * 获取格式对应的文件扩展名
   */
  static getExtension(format: OutputFormat): string {
    const extensionMap: Record<OutputFormat, string> = {
      pdf: '.pdf',
      txt: '.txt',
      md: '.md',
      json: '.json',
    };
    return extensionMap[format];
  }
}
