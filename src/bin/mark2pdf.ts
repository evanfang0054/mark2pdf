#!/usr/bin/env node

import { Command } from 'commander';
import { CLIHandler } from '../cli/handler';
import { version } from '../../package.json';

type CommandHandler = (command: string, options: Record<string, unknown>) => Promise<void>;

const defaultCommandHandler: CommandHandler = (command, options) => CLIHandler.handleCommand(command, options);

export function createProgram(commandHandler: CommandHandler = defaultCommandHandler): Command {
  const program = new Command();

  // 命令行接口设计 (TypeScript + Commander v12+)
  program
    .name('mark2pdf')
    .description('专业的 Markdown 转 PDF 工具')
    .version(version);

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
    .option('--verbose', '详细输出')
    .action(async (options) => {
      await commandHandler('convert', options);
    });

  program
    .command('html')
    .description('转换 HTML 为 PDF')
    .option('-i, --input <path>', '输入目录', './public/html')
    .option('-o, --output <path>', '输出目录')
    .option('-c, --config <path>', '配置文件路径')
    .option('--format <type>', '页面格式', 'A4')
    .option('--verbose', '详细输出')
    .action(async (options) => {
      await commandHandler('html', options);
    });

  program
    .command('merge')
    .description('合并 PDF 文件')
    .option('-i, --input <path>', '输入目录', './dist/pdf')
    .option('-o, --output <path>', '输出目录')
    .option('-c, --config <path>', '配置文件路径')
    .option('--verbose', '详细输出')
    .action(async (options) => {
      await commandHandler('merge', options);
    });

  program
    .command('extract')
    .description('从 PDF/Word 文档提取文本')
    .option('-i, --input <path>', '输入文件或目录', './input')
    .option('-o, --output <path>', '输出目录')
    .option('-f, --format <format>', '输出格式 (txt|md|json)', 'txt')
    .option('--verbose', '详细输出')
    .action(async (options) => {
      await commandHandler('extract', options);
    });

  program
    .command('init')
    .description('初始化配置文件')
    .option('-g, --global', '创建全局配置')
    .action(async (options) => {
      await commandHandler('init', options);
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
