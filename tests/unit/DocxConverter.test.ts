import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocxConverter } from '@/core/DocxConverter';

// 简化 mock - 只 mock 文件系统
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock mammoth
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(),
    convertToHtml: vi.fn(),
  },
  extractRawText: vi.fn(),
  convertToHtml: vi.fn(),
}));

import fs from 'fs/promises';
import mammoth from 'mammoth';

describe('DocxConverter', () => {
  let converter: DocxConverter;

  beforeEach(() => {
    vi.clearAllMocks();
    converter = new DocxConverter({
      format: 'txt',
      outputDir: './test-output',
    });
  });

  describe('constructor', () => {
    it('should create converter with default options', () => {
      const defaultConverter = new DocxConverter();
      expect(defaultConverter).toBeInstanceOf(DocxConverter);
    });

    it('should accept custom options', () => {
      const customConverter = new DocxConverter({
        format: 'md',
        outputDir: './custom-output',
      });
      expect(customConverter).toBeInstanceOf(DocxConverter);
    });
  });

  describe('_htmlToMarkdown', () => {
    // 测试私有方法的转换逻辑（通过公共方法间接测试）
    it('should convert HTML headings to Markdown', async () => {
      const mockHtml = '<h1>Title</h1><h2>Subtitle</h2>';
      (mammoth.convertToHtml as any).mockResolvedValue({ value: mockHtml, messages: [] });
      (fs.readFile as any).mockResolvedValue(Buffer.from('mock'));

      const result = await converter.extractMarkdown('./test.docx');

      expect(result).toContain('# Title');
      expect(result).toContain('## Subtitle');
    });

    it('should convert HTML paragraphs to Markdown', async () => {
      const mockHtml = '<p>Hello World</p><p>Second paragraph</p>';
      (mammoth.convertToHtml as any).mockResolvedValue({ value: mockHtml, messages: [] });
      (fs.readFile as any).mockResolvedValue(Buffer.from('mock'));

      const result = await converter.extractMarkdown('./test.docx');

      expect(result).toContain('Hello World');
      expect(result).toContain('Second paragraph');
    });

    it('should convert bold and italic text', async () => {
      const mockHtml = '<p><strong>bold</strong> and <em>italic</em></p>';
      (mammoth.convertToHtml as any).mockResolvedValue({ value: mockHtml, messages: [] });
      (fs.readFile as any).mockResolvedValue(Buffer.from('mock'));

      const result = await converter.extractMarkdown('./test.docx');

      expect(result).toContain('**bold**');
      expect(result).toContain('*italic*');
    });

    it('should convert list items', async () => {
      const mockHtml = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      (mammoth.convertToHtml as any).mockResolvedValue({ value: mockHtml, messages: [] });
      (fs.readFile as any).mockResolvedValue(Buffer.from('mock'));

      const result = await converter.extractMarkdown('./test.docx');

      expect(result).toContain('- Item 1');
      expect(result).toContain('- Item 2');
    });

    it('should handle HTML entities', async () => {
      const mockHtml = '<p>&lt;code&gt; &amp; &quot;quote&quot;</p>';
      (mammoth.convertToHtml as any).mockResolvedValue({ value: mockHtml, messages: [] });
      (fs.readFile as any).mockResolvedValue(Buffer.from('mock'));

      const result = await converter.extractMarkdown('./test.docx');

      expect(result).toContain('<code>');
      expect(result).toContain('&');
      expect(result).toContain('"quote"');
    });
  });

  describe('convert', () => {
    it('should return success result on successful conversion', async () => {
      const mockText = 'Test content';
      (mammoth.extractRawText as any).mockResolvedValue({ value: mockText, messages: [] });
      (fs.readFile as any).mockResolvedValue(Buffer.from('mock'));
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.mkdir as any).mockResolvedValue(undefined);

      const result = await converter.convert('./test.docx');

      expect(result.success).toBe(true);
      expect(result.file).toBe('./test.docx');
      expect(result.content).toBe(mockText);
    });

    it('should return error result on file read failure', async () => {
      (fs.readFile as any).mockRejectedValue(new Error('File not found'));

      const result = await converter.convert('./nonexistent.docx');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should return error result on extraction failure', async () => {
      (fs.readFile as any).mockResolvedValue(Buffer.from('mock'));
      (mammoth.extractRawText as any).mockRejectedValue(new Error('Invalid docx format'));

      const result = await converter.convert('./test.docx');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid docx format');
    });
  });

  describe('convertBatch', () => {
    it('should convert multiple files', async () => {
      const files = ['./file1.docx', './file2.docx'];
      const mockText = 'content';

      (mammoth.extractRawText as any).mockResolvedValue({ value: mockText, messages: [] });
      (fs.readFile as any).mockResolvedValue(Buffer.from('mock'));
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.mkdir as any).mockResolvedValue(undefined);

      const results = await converter.convertBatch(files);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should continue on individual file errors', async () => {
      const files = ['./file1.docx', './file2.docx'];

      (fs.readFile as any)
        .mockResolvedValueOnce(Buffer.from('mock'))
        .mockRejectedValueOnce(new Error('Error on file 2'));
      (mammoth.extractRawText as any).mockResolvedValue({ value: 'content', messages: [] });
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.mkdir as any).mockResolvedValue(undefined);

      const results = await converter.convertBatch(files);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('updateOptions', () => {
    it('should update converter options', () => {
      converter.updateOptions({ format: 'md' });
      // 验证没有抛出错误
      expect(converter).toBeInstanceOf(DocxConverter);
    });
  });
});
