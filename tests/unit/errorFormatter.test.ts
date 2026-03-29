import { describe, expect, it } from 'vitest';
import { ErrorFormatter } from '@/utils/errorFormatter';

describe('ErrorFormatter', () => {
  describe('toStructuredError in json mode', () => {
    it('formats argument errors as structured json output', () => {
      expect(ErrorFormatter.toStructuredError(new Error('invalid option --foo'), true)).toEqual({
        error: 'argument',
        message: 'invalid option --foo',
        hint: 'mark2pdf --help',
      });
    });

    it('formats path errors as structured json output', () => {
      expect(ErrorFormatter.toStructuredError(new Error('ENOENT: no such file or directory'), true)).toEqual({
        error: 'path',
        message: 'ENOENT: no such file or directory',
        hint: 'mark2pdf convert --show-config',
      });
    });

    it('formats permission errors as structured json output', () => {
      expect(ErrorFormatter.toStructuredError(new Error('permission denied'), true)).toEqual({
        error: 'permission',
        message: 'permission denied',
        hint: 'mark2pdf convert -o ./output',
      });
    });

    it('falls back to runtime for unknown errors and string input', () => {
      expect(ErrorFormatter.toStructuredError('unexpected failure', true)).toEqual({
        error: 'runtime',
        message: 'unexpected failure',
        hint: 'mark2pdf --verbose convert --dry-run',
      });
    });
  });

  describe('toStructuredError in human-readable mode', () => {
    it('returns readable cli error text for argument errors', () => {
      expect(ErrorFormatter.toStructuredError(new Error('invalid 参数'), false)).toBe(
        '[CLI_ERROR]\n类别: argument\n摘要: invalid 参数\n建议: mark2pdf --help'
      );
    });

    it('returns readable cli error text for path errors', () => {
      expect(ErrorFormatter.toStructuredError(new Error('路径不存在'), false)).toBe(
        '[CLI_ERROR]\n类别: path\n摘要: 路径不存在\n建议: mark2pdf convert --show-config'
      );
    });

    it('returns readable cli error text for permission errors', () => {
      expect(ErrorFormatter.toStructuredError(new Error('权限不足'), false)).toBe(
        '[CLI_ERROR]\n类别: permission\n摘要: 权限不足\n建议: mark2pdf convert -o ./output'
      );
    });

    it('returns readable cli error text for runtime errors', () => {
      expect(ErrorFormatter.toStructuredError(new Error('boom'), false)).toBe(
        '[CLI_ERROR]\n类别: runtime\n摘要: boom\n建议: mark2pdf --verbose convert --dry-run'
      );
    });
  });
});
