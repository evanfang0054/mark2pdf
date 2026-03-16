import { describe, it, expect } from 'vitest';
import {
  OutputFormatter,
  OutputFormat,
  ContentMetadata,
} from '@/utils/outputFormatter';

describe('OutputFormatter', () => {
  describe('format', () => {
    const testContent = 'Hello World\n这是测试内容';
    const testMetadata: ContentMetadata = {
      title: 'Test Document',
      source: './test.md',
      wordCount: 10,
    };

    it('should format as txt', () => {
      const result = OutputFormatter.format(testContent, 'txt', testMetadata);

      expect(result.extension).toBe('.txt');
      expect(result.mimeType).toBe('text/plain');
      expect(typeof result.content).toBe('string');
    });

    it('should format as md', () => {
      const result = OutputFormatter.format(testContent, 'md', testMetadata);

      expect(result.extension).toBe('.md');
      expect(result.mimeType).toBe('text/markdown');
      expect(typeof result.content).toBe('string');
      expect(result.content).toContain('# Test Document');
      expect(result.content).toContain('来源: ./test.md');
    });

    it('should format as json', () => {
      const result = OutputFormatter.format(testContent, 'json', testMetadata);

      expect(result.extension).toBe('.json');
      expect(result.mimeType).toBe('application/json');
      expect(typeof result.content).toBe('string');

      const parsed = JSON.parse(result.content as string);
      expect(parsed.title).toBe('Test Document');
      expect(parsed.source).toBe('./test.md');
      expect(parsed.wordCount).toBe(10);
    });

    it('should format as pdf (pass-through)', () => {
      const result = OutputFormatter.format(testContent, 'pdf');

      expect(result.extension).toBe('.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.content).toBe(testContent);
    });

    it('should work without metadata', () => {
      const result = OutputFormatter.format(testContent, 'txt');

      expect(result.extension).toBe('.txt');
      expect(result.content).toBeDefined();
    });
  });

  describe('cleanText', () => {
    it('should normalize line endings', () => {
      const input = 'line1\r\nline2\r\nline3';
      const result = OutputFormatter.cleanText(input);

      expect(result).toBe('line1\nline2\nline3');
    });

    it('should merge multiple blank lines', () => {
      const input = 'line1\n\n\n\n\nline2';
      const result = OutputFormatter.cleanText(input);

      expect(result).toBe('line1\n\nline2');
    });

    it('should merge multiple spaces', () => {
      const input = 'word1     word2     word3';
      const result = OutputFormatter.cleanText(input);

      expect(result).toBe('word1 word2 word3');
    });

    it('should trim leading and trailing spaces from lines', () => {
      const input = '  line1  \n  line2  \n  line3  ';
      const result = OutputFormatter.cleanText(input);

      expect(result).toBe('line1\nline2\nline3');
    });

    it('should trim the whole text', () => {
      const input = '  \n  content  \n  ';
      const result = OutputFormatter.cleanText(input);

      expect(result).toBe('content');
    });
  });

  describe('countWords', () => {
    it('should count Chinese characters', () => {
      const result = OutputFormatter.countWords('这是中文测试');

      expect(result).toBe(6);
    });

    it('should count English words', () => {
      const result = OutputFormatter.countWords('hello world test');

      expect(result).toBe(3);
    });

    it('should count mixed Chinese and English', () => {
      const result = OutputFormatter.countWords('这是test测试content');

      // 4 Chinese chars + 2 English words = 6
      expect(result).toBe(6);
    });

    it('should return 0 for empty string', () => {
      const result = OutputFormatter.countWords('');

      expect(result).toBe(0);
    });
  });

  describe('inferFormat', () => {
    it('should infer txt format', () => {
      expect(OutputFormatter.inferFormat('./output/file.txt')).toBe('txt');
    });

    it('should infer md format', () => {
      expect(OutputFormatter.inferFormat('./output/file.md')).toBe('md');
    });

    it('should infer json format', () => {
      expect(OutputFormatter.inferFormat('./output/file.json')).toBe('json');
    });

    it('should infer pdf format', () => {
      expect(OutputFormatter.inferFormat('./output/file.pdf')).toBe('pdf');
    });

    it('should default to pdf for unknown extension', () => {
      expect(OutputFormatter.inferFormat('./output/file.xyz')).toBe('pdf');
    });

    it('should be case-insensitive', () => {
      expect(OutputFormatter.inferFormat('./output/file.TXT')).toBe('txt');
      expect(OutputFormatter.inferFormat('./output/file.MD')).toBe('md');
    });
  });

  describe('getExtension', () => {
    it('should return correct extension for each format', () => {
      expect(OutputFormatter.getExtension('pdf')).toBe('.pdf');
      expect(OutputFormatter.getExtension('txt')).toBe('.txt');
      expect(OutputFormatter.getExtension('md')).toBe('.md');
      expect(OutputFormatter.getExtension('json')).toBe('.json');
    });
  });
});
