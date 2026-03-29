#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { CLIHandler } from '../cli/handler';
import { version } from '../../package.json';

type CommandHandler = (command: string, options: Record<string, unknown>) => Promise<void>;

type SupportedCompletionShell = 'bash' | 'zsh';

type CommandWithGlobalOptions = {
  optsWithGlobals?: () => Record<string, unknown>;
};

const defaultCommandHandler: CommandHandler = (command, options) => CLIHandler.handleCommand(command, options);

function mergeActionOptions(
  options: Record<string, unknown>,
  command: CommandWithGlobalOptions
): Record<string, unknown> {
  const globalOptions = typeof command.optsWithGlobals === 'function'
    ? command.optsWithGlobals()
    : {};

  return {
    ...globalOptions,
    ...options,
  };
}

function resolveCompletionScriptPath(shell: SupportedCompletionShell): string {
  const fileName = shell === 'zsh' ? '_mark2pdf' : 'mark2pdf.bash';
  return path.resolve(__dirname, '..', '..', 'completions', shell, fileName);
}

function printCompletionScript(shellArg?: string): never {
  const shell = (shellArg || 'bash') as SupportedCompletionShell;

  if (shell !== 'bash' && shell !== 'zsh') {
    console.error(`Unsupported shell: ${shellArg || shell}`);
    console.error('Supported shells: bash, zsh');
    process.exit(1);
  }

  const scriptPath = resolveCompletionScriptPath(shell);

  if (!fs.existsSync(scriptPath)) {
    console.error(`Completion script not found: ${scriptPath}`);
    process.exit(1);
  }

  process.stdout.write(fs.readFileSync(scriptPath, 'utf-8'));
  process.exit(0);
}

export function createProgram(commandHandler: CommandHandler = defaultCommandHandler): Command {
  const program = new Command();

  // 命令行接口设计 (TypeScript + Commander v12+)
  program
    .name('mark2pdf')
    .description('统一文档处理 CLI，支持转换、提取与合并')
    .version(version)
    .option('--json', '结构化 JSON 输出（Agent 模式）')
    .option('--no-color', '禁用颜色输出')
    .option('-q, --quiet', '静默模式（仅输出错误）')
    .option('--no-input', '禁用交互式提示')
    .option('-v, --verbose', '详细输出')
    .option('--limit <number>', '最大处理文件数（默认 50，0 表示无限制）', (val) => parseInt(val, 10), 50);

  // 主命令（默认为 convert）
  program
    .command('convert', { isDefault: true })
    .description('统一入口：按输入类型自动分发转换/提取')
    .option('-i, --input <path>', '输入文件或目录', './public/md')
    .option('-o, --output <path>', '输出目录')
    .option('-c, --config <path>', '配置文件路径')
    .option('-t, --theme <name>', 'PDF 主题名称（仅 Markdown）')
    .option('--concurrent <number>', '并发数', (val) => parseInt(val, 10))
    .option('--timeout <number>', '超时时间(ms)', (val) => parseInt(val, 10))
    .option('--page-size <size>', 'PDF 页面规格 (A4|Letter|A3|A5)', 'A4')
    .option('--out-format <format>', '文本输出格式 (txt|md|json，仅 docx/pdf 提取)', 'txt')
    .option('--dry-run', '仅输出执行计划，不创建文件、不执行转换')
    .option('--show-config', '打印最终生效配置及来源')
    .option('--report-json <path>', '输出结构化执行报告 JSON 文件')
    .option('--format <type>', '【已弃用】请使用 --page-size')
    .addHelpText('after', `
示例:
  $ mark2pdf convert -i ./docs -o ./output
  $ mark2pdf convert --dry-run --show-config
  $ mark2pdf --json --limit 10 convert --dry-run
  $ mark2pdf --no-input --quiet convert
`)
    .action(async (options, command) => {
      await commandHandler('convert', mergeActionOptions(options, command));
    });

  program
    .command('html')
    .description('转换 HTML 为 PDF')
    .option('-i, --input <path>', '输入目录', './public/html')
    .option('-o, --output <path>', '输出目录')
    .option('-c, --config <path>', '配置文件路径')
    .option('--format <type>', '页面格式', 'A4')
    .action(async (options, command) => {
      await commandHandler('html', mergeActionOptions(options, command));
    });

  program
    .command('merge')
    .description('合并 PDF 文件')
    .option('-i, --input <path>', '输入目录', './dist/pdf')
    .option('-o, --output <path>', '输出目录')
    .option('-c, --config <path>', '配置文件路径')
    .action(async (options, command) => {
      await commandHandler('merge', mergeActionOptions(options, command));
    });

  program
    .command('extract')
    .description('从 PDF/Word 文档提取文本')
    .option('-i, --input <path>', '输入文件或目录', './input')
    .option('-o, --output <path>', '输出目录')
    .option('--out-format <format>', '输出格式 (txt|md|json)', 'txt')
    .option('-f, --format <format>', '【已弃用】请使用 --out-format')
    .addHelpText('after', `
示例:
  $ mark2pdf extract -i ./docs/report.pdf -o ./output --out-format txt
  $ mark2pdf --json extract -i ./docs -o ./output --out-format json
`)
    .action(async (options, command) => {
      await commandHandler('extract', mergeActionOptions(options, command));
    });

  program
    .command('init')
    .description('初始化配置文件')
    .option('-g, --global', '创建全局配置')
    .action(async (options, command) => {
      await commandHandler('init', mergeActionOptions(options, command));
    });

  program
    .command('completion [shell]')
    .description('输出 shell 补全脚本')
    .addHelpText('after', `
示例:
  $ mark2pdf completion bash
  $ mark2pdf completion zsh
`)
    .action((shell) => {
      printCompletionScript(shell);
    });

  return program;
}

function resolveArgParseExitCode(error: unknown): number | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  const maybeCommanderCode = (error as Error & { code?: string }).code;
  if (maybeCommanderCode === 'commander.helpDisplayed') {
    return 0;
  }

  if (typeof maybeCommanderCode === 'string' && maybeCommanderCode.startsWith('commander.')) {
    console.error('提示：使用 --help 查看命令用法');
    return 1;
  }

  return undefined;
}

export async function runCli(
  argv: string[] = process.argv,
  commandHandler: CommandHandler = defaultCommandHandler
): Promise<number> {
  const program = createProgram(commandHandler);
  program.exitOverride();
  for (const command of program.commands) {
    command.exitOverride();
  }

  try {
    await program.parseAsync(argv);
    return 0;
  } catch (error) {
    const exitCode = resolveArgParseExitCode(error);
    if (exitCode !== undefined) {
      return exitCode;
    }

    if (error instanceof Error && /^Process exited with code \d+$/u.test(error.message)) {
      return Number(error.message.replace('Process exited with code ', ''));
    }

    throw error;
  }
}

async function main(): Promise<void> {
  const exitCode = await runCli();
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

if (process.env.MARK2PDF_TEST !== '1') {
  void main();
}
