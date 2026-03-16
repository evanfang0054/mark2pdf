import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfExtractor } from '@/core/PdfExtractor';

// Mock fs/promises
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

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: vi.fn().mockResolvedValue({
      text: 'Mock PDF text content',
      metadata: { pages: 1 },
    }),
  })),
}));

import fs from 'fs/promises';
import { PDFParse } from 'pdf-parse';

describe('PdfExtractor', () => {
  let extractor: PdfExtractor;

  beforeEach(() => {
    vi.clearAllMocks();
    extractor = new PdfExtractor({
      format: 'txt',
      outputDir: './test-output',
    });
  });

  describe('constructor', () => {
    it('should create extractor with default options', () => {
      const defaultExtractor = new PdfExtractor();
      expect(defaultExtractor).toBeInstanceOf(PdfExtractor);
    });

    it('should accept custom options', () => {
      const customExtractor = new PdfExtractor({
        format: 'md',
        outputDir: './custom-output',
        cleanText: false,
      });
      expect(customExtractor).toBeInstanceOf(PdfExtractor);
    });
  });

  describe('extractText', () => {
    it('should extract text from PDF', async () => {
      const mockText = 'Hello World\nThis is test content';
      (PDFParse as any).mockImplementation(() => ({
        getText: vi.fn().mockResolvedValue({
          text: mockText,
          metadata: { pages: 1 },
        }),
      }));
      (fs.readFile as any).mockResolvedValue(Buffer.from('mock pdf content'));

      const result = await extractor.extractText('./test.pdf');

      expect(result).toContain('Hello World');
    });

    it('should clean text when cleanText option is enabled', async () => {
      const mockText = 'line1\r\n\r\n\r\nline2     word';
      (PDFParse as any).mockImplementation(() => ({
        getText: vi.fn().mockResolvedValue({
          text: mockText,
          metadata: { pages: 1 },
        }),
      }));
      (fs.readFile as any).mockResolvedValue(Buffer.from('mock'));

      const result = await extractor.extractText('./test.pdf');

      // 应该合并多余换行和空格
      expect(result).not.toContain('\r\n\r\n\r\n');
      expect(result).not.toContain('     ');
    });
  });

  describe('extractStructured', () => {
    it('should extract structured content with metadata', async () => {
      const mockText = 'Document Title\nContent here';
      (PDFParse as any).mockImplementation(() => ({
        getText: vi.fn().mockResolvedValue({
          text: mockText,
          metadata: { pages: 2 },
        }),
      }));
      (fs.readFile as any).mockResolvedValue(Buffer.from('mock'));

      const result = await extractor.extractStructured('./test.pdf');

      expect(result.title).toBeDefined();
      expect(result.pages).toHaveLength(1);
      expect(result.metadata.wordCount).toBeGreaterThan(0);
    });
  });

  describe('extract', () => {
    it('should return success result on successful extraction', async () => {
      const mockText = 'Test content';
      (PDFParse as any).mockImplementation(() => ({
        getText: vi.fn().mockResolvedValue({
          text: mockText,
          metadata: { pages: 1 },
        }),
      }));
      (fs.readFile as any).mockResolvedValue(Buffer.from('mock'));
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.mkdir as any).mockResolvedValue(undefined);

      const result = await extractor.extract('./test.pdf');

      expect(result.success).toBe(true);
      expect(result.file).toBe('./test.pdf');
      expect(result.content).toBeDefined();
    });

    it('should return error result on file read failure', async () => {
      (fs.readFile as any).mockRejectedValue(new Error('File not found'));

      const result = await extractor.extract('./nonexistent.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should return error result on extraction failure', async () => {
      (fs.readFile as any).mockResolvedValue(Buffer.from('mock'));
      (PDFParse as any).mockImplementation(() => ({
        getText: vi.fn().mockRejectedValue(new Error('Invalid PDF format')),
      }));

      const result = await extractor.extract('./test.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid PDF format');
    });
  });

  describe('extractBatch', () => {
    it('should extract multiple files', async () => {
      const files = ['./file1.pdf', './file2.pdf'];
      const mockText = 'content';

      (PDFParse as any).mockImplementation(() => ({
        getText: vi.fn().mockResolvedValue({
          text: mockText,
          metadata: { pages: 1 },
        }),
      }));
      (fs.readFile as any).mockResolvedValue(Buffer.from('mock'));
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.mkdir as any).mockResolvedValue(undefined);

      const results = await extractor.extractBatch(files);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should continue on individual file errors', async () => {
      const files = ['./file1.pdf', './file2.pdf'];

      // 让第二个文件读取失败
      let readCallCount = 0;
      (fs.readFile as any).mockImplementation(async () => {
        readCallCount++;
        if (readCallCount <= 2) {
          // 第一个文件的 extractText 和 extractStructured
          return Buffer.from('mock');
        }
        throw new Error('File read error');
      });

      (PDFParse as any).mockImplementation(() => ({
        getText: vi.fn().mockResolvedValue({
          text: 'content',
          metadata: { pages: 1 },
        }),
      }));

      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.mkdir as any).mockResolvedValue(undefined);

      const results = await extractor.extractBatch(files);

      expect(results).toHaveLength(2);
      // 第一个文件应该成功
      expect(results[0].success).toBe(true);
      // 第二个文件应该失败（因为 readFile 失败）
      expect(results[1].success).toBe(false);
    });
  });

  describe('updateOptions', () => {
    it('should update extractor options', () => {
      extractor.updateOptions({ format: 'md' });
      expect(extractor).toBeInstanceOf(PdfExtractor);
    });
  });
});
