import { describe, it, expect } from 'vitest';
import {
  detectInputType,
  getExtensionsForType,
  isSupportedInputType,
  getSupportedExtensions,
  InputType,
} from '@/utils/inputDetector';

describe('InputDetector', () => {
  describe('detectInputType', () => {
    it('should detect markdown files', () => {
      expect(detectInputType('test.md')).toBe('md');
      expect(detectInputType('test.markdown')).toBe('md');
      expect(detectInputType('path/to/test.md')).toBe('md');
      expect(detectInputType('PATH/TO/TEST.MD')).toBe('md');
    });

    it('should detect HTML files', () => {
      expect(detectInputType('test.html')).toBe('html');
      expect(detectInputType('path/to/test.html')).toBe('html');
      expect(detectInputType('PATH/TO/TEST.HTML')).toBe('html');
    });

    it('should detect Word files', () => {
      expect(detectInputType('test.docx')).toBe('docx');
      expect(detectInputType('path/to/test.docx')).toBe('docx');
      expect(detectInputType('PATH/TO/TEST.DOCX')).toBe('docx');
    });

    it('should detect PDF files', () => {
      expect(detectInputType('test.pdf')).toBe('pdf');
      expect(detectInputType('path/to/test.pdf')).toBe('pdf');
      expect(detectInputType('PATH/TO/TEST.PDF')).toBe('pdf');
    });

    it('should return unknown for unsupported extensions', () => {
      expect(detectInputType('test.txt')).toBe('unknown');
      expect(detectInputType('test.doc')).toBe('unknown');
      expect(detectInputType('test.xls')).toBe('unknown');
      expect(detectInputType('test')).toBe('unknown');
    });
  });

  describe('getExtensionsForType', () => {
    it('should return correct extensions for each type', () => {
      expect(getExtensionsForType('md')).toEqual(['.md', '.markdown']);
      expect(getExtensionsForType('html')).toEqual(['.html', '.htm']);
      expect(getExtensionsForType('docx')).toEqual(['.docx']);
      expect(getExtensionsForType('pdf')).toEqual(['.pdf']);
    });

    it('should return empty array for unknown type', () => {
      expect(getExtensionsForType('unknown' as InputType)).toEqual([]);
    });
  });

  describe('isSupportedInputType', () => {
    it('should return true for supported types', () => {
      expect(isSupportedInputType('test.md')).toBe(true);
      expect(isSupportedInputType('test.html')).toBe(true);
      expect(isSupportedInputType('test.docx')).toBe(true);
      expect(isSupportedInputType('test.pdf')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(isSupportedInputType('test.txt')).toBe(false);
      expect(isSupportedInputType('test.doc')).toBe(false);
      expect(isSupportedInputType('test')).toBe(false);
    });
  });

  describe('getSupportedExtensions', () => {
    it('should return all supported extensions', () => {
      const extensions = getSupportedExtensions();

      expect(extensions).toContain('.md');
      expect(extensions).toContain('.markdown');
      expect(extensions).toContain('.html');
      expect(extensions).toContain('.htm');
      expect(extensions).toContain('.docx');
      expect(extensions).toContain('.pdf');
    });

    it('should return an array', () => {
      const extensions = getSupportedExtensions();
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);
    });
  });
});
