import path from 'path';

export type SupportedCommand = 'convert' | 'html' | 'merge' | 'extract';

const COMMAND_OUTPUT_DIR: Record<SupportedCommand, string> = {
  convert: 'convert',
  html: 'html',
  merge: 'merge',
  extract: 'extract',
};

export function resolveDefaultOutputPath(command: SupportedCommand, cwd = process.cwd()): string {
  return path.join(cwd, 'output', COMMAND_OUTPUT_DIR[command]);
}

export function resolveLatestReportPath(command: SupportedCommand, cwd = process.cwd()): string {
  return path.join(resolveDefaultOutputPath(command, cwd), '_latest-report.json');
}

export function resolveEffectiveOutputPath(
  command: SupportedCommand,
  cliOutput?: string,
  cwd = process.cwd()
): string {
  return cliOutput ?? resolveDefaultOutputPath(command, cwd);
}
