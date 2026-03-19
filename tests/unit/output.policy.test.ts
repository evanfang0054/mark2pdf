import { describe, expect, it } from 'vitest';
import {
  resolveDefaultOutputPath,
  resolveEffectiveOutputPath,
  resolveLatestReportPath,
} from '@/cli/output-policy';

describe('output policy', () => {
  it('resolves command-scoped default output directory from cwd', () => {
    expect(resolveDefaultOutputPath('convert', '/tmp/ws')).toBe('/tmp/ws/output/convert');
    expect(resolveDefaultOutputPath('html', '/tmp/ws')).toBe('/tmp/ws/output/html');
    expect(resolveDefaultOutputPath('merge', '/tmp/ws')).toBe('/tmp/ws/output/merge');
    expect(resolveDefaultOutputPath('extract', '/tmp/ws')).toBe('/tmp/ws/output/extract');
  });

  it('keeps CLI output when explicitly provided', () => {
    expect(resolveEffectiveOutputPath('merge', './custom', '/tmp/ws')).toBe('./custom');
  });

  it('resolves fixed latest report path under output/<cmd>', () => {
    expect(resolveLatestReportPath('merge', '/tmp/ws')).toBe('/tmp/ws/output/merge/_latest-report.json');
  });
});
