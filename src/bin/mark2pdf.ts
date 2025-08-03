#!/usr/bin/env node

import { program } from 'commander';
import { CLIHandler } from '../cli/handler';
import { version } from '../../package.json';

// 命令行接口设计 (TypeScript + Commander v12+)
program
  .name('mark2pdf')
  .description('专业的 Markdown 转 PDF 工具')
  .version(version);

// 主命令（默认为 convert）
program
  .command('convert', { isDefault: true })
  .description('转换 Markdown 为 PDF')
  .option('-i, --input <path>', '输入目录', './public/md')
  .option('-o, --output <path>', '输出目录', './dist/pdf')
  .option('-c, --config <path>', '配置文件路径')
  .option('-t, --theme <name>', '主题名称')
  .option('--concurrent <number>', '并发数', (val) => parseInt(val, 10))
  .option('--timeout <number>', '超时时间(ms)', (val) => parseInt(val, 10))
  .option('--format <type>', '页面格式', 'A4')
  .option('--verbose', '详细输出')
  .action(async (options) => {
    await CLIHandler.handleCommand('convert', options);
  });

program
  .command('html')
  .description('转换 HTML 为 PDF')
  .option('-i, --input <path>', '输入目录', './public/html')
  .option('-o, --output <path>', '输出目录', './dist/pdf')
  .option('-c, --config <path>', '配置文件路径')
  .option('--format <type>', '页面格式', 'A4')
  .option('--verbose', '详细输出')
  .action(async (options) => {
    await CLIHandler.handleCommand('html', options);
  });

program
  .command('merge')
  .description('合并 PDF 文件')
  .option('-i, --input <path>', '输入目录', './dist/pdf')
  .option('-o, --output <path>', '输出目录', './dist/mergePdf')
  .option('-c, --config <path>', '配置文件路径')
  .option('--verbose', '详细输出')
  .action(async (options) => {
    await CLIHandler.handleCommand('merge', options);
  });

program
  .command('init')
  .description('初始化配置文件')
  .option('-g, --global', '创建全局配置')
  .action(async (options) => {
    await CLIHandler.handleCommand('init', options);
  });

program.parse();
