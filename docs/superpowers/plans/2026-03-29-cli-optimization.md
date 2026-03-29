# mark2pdf CLI 优化实施计划

> **for agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过渐进式增强方案，将 mark2pdf CLI 升级为同时支持人类用户和 AI 代理的高质量命令行工具

**架构:** 在现有架构基础上增量添加全局标志、结构化输出和标志语义统一，通过 v3.0.0 版本引入破坏性变更

**Tech Stack:** TypeScript + Commander.js + chalk + cli-progress

---

## 文件结构

**创建文件:**
- `src/utils/jsonOutput.ts` - JSON 输出格式化工具
- `src/utils/errorFormatter.ts` - 结构化错误格式化
- `completions/bash/mark2pdf.bash` - Bash 补全脚本
- `completions/zsh/_mark2pdf` - Zsh 补全脚本
- `docs/cli-spec.md` - CLI 规范文档

**修改文件:**
- `src/bin/mark2pdf.ts` - 添加全局标志、帮助示例、补全命令
- `src/cli/handler.ts` - 实现三级输出、JSON 输出、结构化错误、列表边界控制
- `src/utils/progress.ts` - 支持 --json 和 --quiet 模式
- `src/config/loader.ts` - 文档化配置优先级
- `package.json` - 升级版本到 3.0.0

**测试文件:**
- `tests/unit/jsonOutput.test.ts` - JSON 输出测试
- `tests/unit/errorFormatter.test.ts` - 错误格式化测试
- `tests/unit/cli.test.ts` - 更新现有测试以支持新标志

---

## 任务分解

### 任务 1: 添加全局标志和输出控制

**文件:**
- Create: `src/utils/jsonOutput.ts`
- Create: `src/utils/errorFormatter.ts`
- Modify: `src/bin/mark2pdf.ts:15-40`
- Modify: `src/cli/handler.ts:1-20`

- [ ] **Step 1: 创建 JSON 输出工具**

创建 `src/utils/jsonOutput.ts`:

```typescript
import chalk from 'chalk';

export interface JsonOutputOptions {
  quiet: boolean;
  json: boolean;
}

export class JsonOutput {
  private quiet: boolean;
  private json: boolean;

  constructor(options: JsonOutputOptions) {
    this.quiet = options.quiet;
    this.json = options.json;

    // JSON 模式自动启用 quiet
    if (this.json) {
      this.quiet = true;
      chalk.level = 0; // 禁用颜色
    }
  }

  shouldSuppressOutput(): boolean {
    return this.quiet || this.json;
  }

  formatList<T>(items: T[], total: number, hasMore: boolean): string | object {
    if (this.json) {
      return {
        items,
        total,
        processed: items.length,
        has_more: hasMore
      };
    }
    return items; // 人类模式返回原始数据
  }

  formatError(error: { category: string; summary: string; action: string }): string | object {
    if (this.json) {
      return {
        error: error.category,
        message: error.summary,
        hint: error.action
      };
    }
    // 人类模式返回可读文本
    return `[CLI_ERROR]\n类别: ${error.category}\n摘要: ${error.summary}\n建议: ${error.action}`;
  }
}
```

- [ ] **Step 2: 运行类型检查**

Run: `pnpm run type-check`
Expected: PASS

- [ ] **Step 3: 创建结构化错误格式化工具**

创建 `src/utils/errorFormatter.ts`:

```typescript
export interface StructuredError {
  error: string;
  message: string;
  hint: string;
}

export class ErrorFormatter {
  static toStructuredError(error: unknown, isJsonMode: boolean): StructuredError | string {
    const message = error instanceof Error ? error.message : String(error);
    const lowered = message.toLowerCase();

    let category = 'runtime';
    let action = '请使用 --verbose 复现并检查详细日志。';

    if (lowered.includes('invalid') || lowered.includes('参数') || lowered.includes('option')) {
      category = 'argument';
      action = 'mark2pdf --help';
    } else if (lowered.includes('path') || lowered.includes('enoent') || lowered.includes('不存在')) {
      category = 'path';
      action = 'mark2pdf convert --show-config';
    } else if (lowered.includes('eacces') || lowered.includes('permission') || lowered.includes('权限')) {
      category = 'permission';
      action = 'chmod -R 755 ./output';
    }

    if (isJsonMode) {
      return {
        error: category,
        message: message,
        hint: action
      };
    }

    return `[CLI_ERROR]\n类别: ${category}\n摘要: ${message}\n建议: ${action}`;
  }
}
```

- [ ] **Step 4: 运行类型检查**

Run: `pnpm run type-check`
Expected: PASS

- [ ] **Step 5: 提交基础工具**

```bash
git add src/utils/jsonOutput.ts src/utils/errorFormatter.ts
git commit -m "feat: add JSON output and error formatting utilities"
```

---

### 任务 2: 更新 CLI 入口添加全局标志

**文件:**
- Modify: `src/bin/mark2pdf.ts:11-20`

- [ ] **Step 1: 添加全局标志**

修改 `src/bin/mark2pdf.ts`，在 `program.version(version)` 后添加:

```typescript
program
  .name('mark2pdf')
  .description('专业的文档格式转换工具')
  .version(version)
  // 新增全局标志
  .option('--json', '结构化 JSON 输出（Agent 模式）')
  .option('--no-color', '禁用颜色输出')
  .option('-q, --quiet', '静默模式（仅输出错误）')
  .option('-v, --verbose', '详细输出')
  .option('--no-input', '禁用交互式提示')
  .option('--limit <number>', '最大处理文件数（默认 50，0 表示无限制）', '50');
```

- [ ] **Step 2: 更新 convert 子命令帮助**

为 `convert` 命令添加帮助示例:

```typescript
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
  .addHelpText('after', `
示例:
  $ mark2pdf convert -i ./docs -o ./output
  $ mark2pdf convert --dry-run --show-config
  $ mark2pdf convert --json --limit 10
  $ mark2pdf convert --no-input --quiet
`)
  .action(async (options) => {
    await commandHandler('convert', options);
  });
```

- [ ] **Step 3: 更新 extract 子命令标志**

将 `extract` 命令的 `--format` 改为 `--out-format`:

```typescript
program
  .command('extract')
  .description('从 PDF/Word 文档提取文本')
  .option('-i, --input <path>', '输入文件或目录', './input')
  .option('-o, --output <path>', '输出目录')
  .option('--out-format <format>', '输出格式 (txt|md|json)', 'txt')  // 改名
  .option('-f, --format <format>', '【已弃用】请使用 --out-format')  // 保留兼容
  .option('--verbose', '详细输出')
  .addHelpText('after', `
示例:
  $ mark2pdf extract document.pdf -o ./output --out-format txt
  $ mark2pdf extract ./docs -o ./output --json
`)
  .action(async (options) => {
    await commandHandler('extract', options);
  });
```

- [ ] **Step 4: 运行类型检查**

Run: `pnpm run type-check`
Expected: PASS

- [ ] **Step 5: 提交 CLI 更新**

```bash
git add src/bin/mark2pdf.ts
git commit -m "feat: add global flags and improve help text"
```

---

### 任务 3: 实现三级输出控制

**文件:**
- Modify: `src/cli/handler.ts:258-285`
- Modify: `src/utils/progress.ts:16-35`

- [ ] **Step 1: 更新 CLIHandler 处理全局选项**

修改 `src/cli/handler.ts` 的 `_normalizeCliOptions` 方法:

```typescript
private static _normalizeCliOptions(options: Record<string, any>): {
  unifiedOptions: UnifiedCLIOptions;
  deprecations: DeprecationEntry[];
} {
  const program = new Command();
  // 从 program 获取全局选项
  const globalOptions = program.opts();

  const unified: UnifiedCLIOptions = {
    input: options.input,
    output: options.output,
    config: options.config,
    theme: options.theme,
    concurrent: options.concurrent,
    timeout: options.timeout,
    pageSize: options.pageSize,
    outputFormat: options.outFormat || options.format, // 支持新旧标志
    dryRun: Boolean(options.dryRun),
    showConfig: Boolean(options.showConfig),
    reportJson: options.reportJson,
    verbose: Boolean(options.verbose),
    // 新增全局选项
    json: Boolean(globalOptions.json),
    quiet: Boolean(globalOptions.quiet),
    noColor: Boolean(globalOptions.noColor),
    noInput: Boolean(globalOptions.noInput),
    limit: parseInt(globalOptions.limit || '50', 10),
  };

  const deprecations: DeprecationEntry[] = [];

  if (options.format && !unified.outputFormat) {
    unified.outputFormat = options.format;
    deprecations.push({ legacy: '--format', replacement: '--out-format' });
  }

  if (options.format && !unified.pageSize) {
    unified.pageSize = options.format;
    deprecations.push({ legacy: '--format', replacement: '--page-size' });
  }

  // 处理环境变量
  if (process.env.NO_COLOR) {
    unified.noColor = true;
  }

  return { unifiedOptions: unified, deprecations };
}
```

- [ ] **Step 2: 更新 ProgressIndicator 支持 JSON 和 quiet 模式**

修改 `src/utils/progress.ts`:

```typescript
export interface ProgressOptions {
  verbose: boolean;
  json: boolean;
  quiet: boolean;
}

export class ProgressIndicator {
  private verbose: boolean;
  private json: boolean;
  private quiet: boolean;
  private startTime: number;
  private processed: number = 0;
  private total: number = 0;
  private progressBar?: cliProgress.SingleBar;

  constructor(options: ProgressOptions) {
    this.verbose = options.verbose;
    this.json = options.json;
    this.quiet = options.quiet;
    this.startTime = Date.now();

    // JSON 或 quiet 模式不显示进度条
    if (this.json || this.quiet) {
      return;
    }
  }

  start(total: number): void {
    if (this.json || this.quiet) {
      return; // 不显示进度条
    }

    this.total = total;
    this.progressBar = new cliProgress.SingleBar({
      format: `${chalk.green('{bar}')} {percentage}% | {value}/${this.total} | ${chalk.cyan('{filename}')} | {speed}`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true
    });

    this.progressBar.start(total, 0, {
      filename: '',
      speed: '0.0s/file'
    });
  }

  update(filename: string): void {
    if (this.json || this.quiet || !this.progressBar) return;

    this.processed++;
    const elapsed = (Date.now() - this.startTime) / 1000;
    const speed = elapsed > 0 ? (elapsed / this.processed).toFixed(1) : '1.0';

    this.progressBar.update(this.processed, {
      filename: path.basename(filename),
      speed: `${speed}s/file`
    });

    if (this.verbose) {
      console.log(`${chalk.blue('处理中:')} ${filename}`);
    }
  }

  complete(): void {
    if (this.json || this.quiet || !this.progressBar) {
      return; // 不显示总结
    }

    this.progressBar.stop();

    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const avgSpeed = this.processed > 0 ? (parseFloat(totalTime) / this.processed).toFixed(2) : '1.00';

    console.log(`\n${chalk.green('✓')} 转换完成！总耗时: ${chalk.cyan(totalTime)}秒, 平均速度: ${chalk.cyan(avgSpeed)}s/文件`);
  }

  error(message: string): void {
    if (!this.json && !this.quiet && this.progressBar) {
      this.progressBar.stop();
    }

    // 即使 quiet 模式也要显示错误
    console.error(chalk.red('✗'), message);
  }

  warn(message: string): void {
    if (this.quiet) return;

    if (this.verbose) {
      console.warn(chalk.yellow('⚠'), message);
    }
  }

  info(message: string): void {
    if (this.quiet || this.json) return;

    if (this.verbose) {
      console.info(chalk.blue('ℹ'), message);
    }
  }
}
```

- [ ] **Step 3: 运行类型检查**

Run: `pnpm run type-check`
Expected: PASS

- [ ] **Step 4: 提交输出控制更新**

```bash
git add src/cli/handler.ts src/utils/progress.ts
git commit -m "feat: implement three-level output control (quiet/default/verbose)"
```

---

### 任务 4: 实现 JSON 输出和结构化错误

**文件:**
- Modify: `src/cli/handler.ts:113-256`

- [ ] **Step 1: 在 handleCommand 中使用 JSON 输出工具**

修改 `src/cli/handler.ts` 的 `handleCommand` 方法开头:

```typescript
static async handleCommand(command: string, options: any) {
  const startedAt = new Date();
  let stage: ExecutionStage = 'input_validate';

  const { unifiedOptions, deprecations } = this._normalizeCliOptions(options || {});
  this._printDeprecations(deprecations);

  // 初始化 JSON 输出工具
  const jsonOutput = new JsonOutput({
    quiet: unifiedOptions.quiet || false,
    json: unifiedOptions.json || false,
  });

  // 设置颜色输出
  if (unifiedOptions.noColor) {
    chalk.level = 0;
  }

  // ... 后续代码使用 jsonOutput.shouldSuppressOutput() 判断是否输出
}
```

- [ ] **Step 2: 更新错误处理使用结构化错误**

修改 `_printActionableError` 方法:

```typescript
private static _printActionableError(error: ActionableError, isJsonMode: boolean = false): void {
  const formatted = ErrorFormatter.toStructuredError(
    new Error(`${error.category}: ${error.summary}`),
    isJsonMode
  );

  if (isJsonMode && typeof formatted === 'object') {
    console.error(JSON.stringify(formatted));
  } else {
    console.error(chalk.red('\n[CLI_ERROR]'));
    console.error(`类别: ${error.category}`);
    console.error(`摘要: ${error.summary}`);
    console.error(`建议: ${error.action}`);
  }
}
```

在调用处更新:

```typescript
} catch (error) {
  if (error instanceof Error && /^Process exited with code \d+$/u.test(error.message)) {
    throw error;
  }

  // ... 省略中间代码 ...

  this._printFailureSummary(normalizedCommand, stage, latestReportPath);
  const actionable = this._toActionableError(error);
  this._printActionableError(actionable, unifiedOptions.json); // 传递 JSON 模式
  process.exit(1);
}
```

- [ ] **Step 3: 实现列表边界控制**

在 `_handleConvertUnified` 方法中添加 limit 检查:

```typescript
private static async _handleConvertUnified(
  config: Mark2pdfConfig,
  progress: ProgressIndicator,
  options: UnifiedCLIOptions
): Promise<StructuredExecutionReport> {
  let plan = await this._buildConvertExecutionPlan(config, options);

  // 应用 limit 限制
  const limit = options.limit || 50;
  const hasMore = limit > 0 && plan.items.length > limit;
  if (hasMore) {
    plan = {
      ...plan,
      items: plan.items.slice(0, limit)
    };
  }

  if (options.dryRun) {
    this._printDryRunPlan(plan, hasMore);
    return this._buildReport('convert', plan.items.length, 0, 0, 0, []);
  }

  // ... 省略后续代码
}
```

- [ ] **Step 4: 更新 dry-run 输出支持 JSON 模式**

修改 `_printDryRunPlan` 方法:

```typescript
private static _printDryRunPlan(plan: ConvertExecutionPlan, hasMore: boolean = false, isJsonMode: boolean = false): void {
  if (isJsonMode) {
    const output = {
      dry_run: true,
      input: plan.inputRoot,
      output: plan.outputRoot,
      total_files: plan.items.length,
      has_more: hasMore,
      items: plan.items.map(item => ({
        action: item.action,
        input: item.inputPath,
        output: item.targetPath,
        reason: item.reason
      }))
    };
    console.log(JSON.stringify(output));
    return;
  }

  // 人类模式输出（现有代码）
  console.log(chalk.cyan('\n🧪 Dry-run 执行计划（无副作用）'));
  // ... 省略
}
```

- [ ] **Step 5: 运行类型检查**

Run: `pnpm run type-check`
Expected: PASS

- [ ] **Step 6: 提交 JSON 输出更新**

```bash
git add src/cli/handler.ts
git commit -m "feat: implement JSON output and structured errors"
```

---

### 任务 5: 统一标志语义

**文件:**
- Modify: `src/cli/handler.ts:278-284`

- [ ] **Step 1: 更新弃用警告处理**

修改 `_normalizeCliOptions` 中的弃用逻辑:

```typescript
if (options.format && !unified.outputFormat) {
  unified.outputFormat = options.format;
  deprecations.push({
    legacy: '--format',
    replacement: '--out-format',
    note: 'extract 命令的 --format 将在 v4.0.0 移除'
  });
}

if (options.format && !unified.pageSize) {
  unified.pageSize = options.format;
  deprecations.push({
    legacy: '--format',
    replacement: '--page-size',
    note: 'convert 命令的 --format 将在 v4.0.0 移除'
  });
}
```

- [ ] **Step 2: 运行类型检查**

Run: `pnpm run type-check`
Expected: PASS

- [ ] **Step 3: 提交标志语义统一**

```bash
git add src/cli/handler.ts
git commit -m "feat: unify flag semantics with deprecation warnings"
```

---

### 任务 6: 添加 Shell 补全支持

**文件:**
- Create: `completions/bash/mark2pdf.bash`
- Create: `completions/zsh/_mark2pdf`
- Modify: `src/bin/mark2pdf.ts:83-100`

- [ ] **Step 1: 创建 Bash 补全脚本**

创建 `completions/bash/mark2pdf.bash`:

```bash
#!/usr/bin/env bash
# mark2pdf bash completion

_mark2pdf_completion() {
  local cur prev words
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  commands="convert html merge extract init completion"

  if [[ ${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${commands}" -- ${cur}) )
    return 0
  fi

  if [[ ${prev} == convert ]]; then
    local options="-i --input -o --output -c --config -t --theme --concurrent --timeout --page-size --out-format --dry-run --show-config --report-json --verbose --json --no-color --quiet --no-input --limit"
    COMPREPLY=( $(compgen -W "${options}" -- ${cur}) )
  fi

  # 可以添加更多子命令的补全规则
}

complete -F _mark2pdf_completion mark2pdf
```

- [ ] **Step 2: 创建 Zsh 补全脚本**

创建 `completions/zsh/_mark2pdf`:

```zsh
#compdef mark2pdf
# mark2pdf zsh completion

local -a commands
commands=(
  'convert:转换 Markdown/HTML 为 PDF 或提取文档'
  'html:转换 HTML 为 PDF'
  'merge:合并 PDF 文件'
  'extract:从 PDF/Word 提取文本'
  'init:初始化配置文件'
  'completion:生成 shell 补全脚本'
)

_arguments \
  '1: :->command' \
  '--json[结构化 JSON 输出]' \
  '--no-color[禁用颜色输出]' \
  '-q[静默模式]' \
  '--quiet[静默模式]' \
  '-v[详细输出]' \
  '--verbose[详细输出]' \
  '--no-input[禁用交互式提示]' \
  '--limit[最大处理文件数]:number' \
  && ret 0

case $words[1] in
  convert)
    _arguments \
      '-i[输入文件或目录]:path' \
      '--input[输入文件或目录]:path' \
      '-o[输出目录]:path' \
      '--output[输出目录]:path' \
      '-c[配置文件路径]:path' \
      '--config[配置文件路径]:path' \
      '--page-size[PDF 页面规格]:size' \
      '--dry-run[仅输出执行计划]' \
      && ret 0
    ;;
esac
```

- [ ] **Step 3: 添加 completion 命令**

修改 `src/bin/mark2pdf.ts`，在 `createProgram` 函数中添加:

```typescript
program
  .command('completion [shell]')
  .description('生成 shell 补全脚本')
  .action((shell) => {
    const shellType = shell || 'bash';
    const scriptPath = path.join(__dirname, '..', '..', 'completions', shellType, 'mark2pdf.' + (shellType === 'zsh' ? '' : shellType));

    if (fs.existsSync(scriptPath)) {
      console.log(fs.readFileSync(scriptPath, 'utf-8'));
    } else {
      console.error(`Unsupported shell: ${shellType}`);
      console.error('Supported shells: bash, zsh');
      process.exit(1);
    }
  });

return program;
```

- [ ] **Step 4: 测试补全功能**

Run: `node dist/bin/mark2pdf.js completion bash`
Expected: 输出 bash 补全脚本

- [ ] **Step 5: 提交补全支持**

```bash
git add completions/ src/bin/mark2pdf.ts
git commit -m "feat: add shell completion support for bash and zsh"
```

---

### 任务 7: 更新测试

**文件:**
- Create: `tests/unit/jsonOutput.test.ts`
- Create: `tests/unit/errorFormatter.test.ts`
- Modify: `tests/unit/cli.test.ts`

- [ ] **Step 1: 创建 JSON 输出测试**

创建 `tests/unit/jsonOutput.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { JsonOutput } from '@/utils/jsonOutput';

describe('JsonOutput', () => {
  it('should suppress output in JSON mode', () => {
    const output = new JsonOutput({ quiet: false, json: true });
    expect(output.shouldSuppressOutput()).toBe(true);
  });

  it('should suppress output in quiet mode', () => {
    const output = new JsonOutput({ quiet: true, json: false });
    expect(output.shouldSuppressOutput()).toBe(true);
  });

  it('should format list with metadata in JSON mode', () => {
    const output = new JsonOutput({ quiet: false, json: true });
    const items = [{ id: 1 }, { id: 2 }];
    const result = output.formatList(items, 100, true);

    expect(result).toEqual({
      items,
      total: 100,
      processed: 2,
      has_more: true
    });
  });

  it('should format error with structured output in JSON mode', () => {
    const output = new JsonOutput({ quiet: false, json: true });
    const error = {
      category: 'path',
      summary: 'Input not found',
      action: 'mark2pdf --show-config'
    };
    const result = output.formatError(error);

    expect(result).toEqual({
      error: 'path',
      message: 'Input not found',
      hint: 'mark2pdf --show-config'
    });
  });
});
```

- [ ] **Step 2: 创建错误格式化测试**

创建 `tests/unit/errorFormatter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ErrorFormatter } from '@/utils/errorFormatter';

describe('ErrorFormatter', () => {
  it('should format path error as structured JSON in JSON mode', () => {
    const error = new Error('ENOENT: no such file or directory');
    const result = ErrorFormatter.toStructuredError(error, true);

    expect(result).toEqual({
      error: 'path',
      message: 'ENOENT: no such file or directory',
      hint: 'mark2pdf convert --show-config'
    });
  });

  it('should format permission error as structured JSON in JSON mode', () => {
    const error = new Error('EACCES: permission denied');
    const result = ErrorFormatter.toStructuredError(error, true);

    expect(result).toEqual({
      error: 'permission',
      message: 'EACCES: permission denied',
      hint: 'chmod -R 755 ./output'
    });
  });

  it('should format error as human-readable string in non-JSON mode', () => {
    const error = new Error('Some error');
    const result = ErrorFormatter.toStructuredError(error, false);

    expect(typeof result).toBe('string');
    expect(result).toContain('[CLI_ERROR]');
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `pnpm test`
Expected: PASS (所有测试通过)

- [ ] **Step 4: 提交测试更新**

```bash
git add tests/unit/jsonOutput.test.ts tests/unit/errorFormatter.test.ts tests/unit/cli.test.ts
git commit -m "test: add tests for JSON output and error formatting"
```

---

### 任务 8: 文档化配置优先级

**文件:**
- Create: `docs/cli-spec.md`
- Modify: `README.md`

- [ ] **Step 1: 创建 CLI 规范文档**

创建 `docs/cli-spec.md`:

```markdown
# mark2pdf CLI 规范

## 配置优先级

配置按以下优先级从高到低加载：

1. **命令行参数** (最高优先级)
   - 例如: `--input ./docs`

2. **环境变量**
   - `MARK2PDF_INPUT_PATH`: 输入路径
   - `MARK2PDF_OUTPUT_PATH`: 输出路径

3. **项目配置文件**
   - `./mark2pdf.config.json`
   - `./config.json`

4. **用户配置文件**
   - `~/.mark2pdf/config.json`

5. **默认值** (最低优先级)

## 全局标志

- `--json`: 结构化 JSON 输出（Agent 模式）
- `--no-color`: 禁用颜色输出
- `-q, --quiet`: 静默模式（仅输出错误）
- `-v, --verbose`: 详细输出
- `--no-input`: 禁用交互式提示
- `--limit <number>`: 最大处理文件数（默认 50，0 表示无限制）

## 输出模式

### 人类模式（默认）
- 彩色输出
- 进度条
- 友好的错误消息

### Agent 模式（--json）
- NDJSON 输出（列表命令）
- 结构化错误（stderr）
- 无颜色代码
- 无进度条

### 静默模式（--quiet）
- 仅输出错误
- 无进度条

## 错误处理

在 `--json` 模式下，错误输出到 stderr，格式为：

\`\`\`json
{
  "error": "category",
  "message": "Error details",
  "hint": "mark2pdf command --flag"
}
\`\`\`

`hint` 字段始终是可执行的命令。
```

- [ ] **Step 2: 更新 README**

在 `README.md` 中添加配置优先级说明章节

- [ ] **Step 3: 提交文档更新**

```bash
git add docs/cli-spec.md README.md
git commit -m "docs: document configuration precedence and CLI specification"
```

---

### 任务 9: 升级版本号

**文件:**
- Modify: `package.json:3`

- [ ] **Step 1: 升级版本到 3.0.0**

修改 `package.json`:

```json
{
  "name": "mark2pdf",
  "version": "3.0.0",
  // ...
}
```

- [ ] **Step 2: 更新 CHANGELOG**

创建 `CHANGELOG.md` 或更新现有文件：

```markdown
# Changelog

## [3.0.0] - 2026-03-29

### Breaking Changes
- `--format` 标志在 `convert` 命令中重命名为 `--page-size`
- `--format` 标志在 `extract` 命令中重命名为 `--out-format`
- 默认列表输出限制为 50 项（可通过 `--limit 0` 移除）

### Added
- 全局 `--json` 标志用于结构化输出（Agent 模式）
- 全局 `--quiet` 标志用于静默模式
- 全局 `--no-color` 标志和环境变量 `NO_COLOR` 支持
- 全局 `--no-input` 标志禁用交互式提示
- 全局 `--limit` 标志控制列表边界
- `mark2pdf completion` 命令生成 shell 补全脚本
- 结构化错误输出（JSON 模式）
- 帮助文本中的使用示例

### Changed
- 改进错误消息可操作性和恢复建议
- 配置优先级现在明确文档化
```

- [ ] **Step 3: 提交版本更新**

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 3.0.0 with breaking changes"
```

---

### 任务 10: 最终测试和构建

**文件:**
- 无文件修改

- [ ] **Step 1: 运行完整测试套件**

Run: `pnpm test`
Expected: PASS (所有测试通过)

- [ ] **Step 2: 运行类型检查**

Run: `pnpm run type-check`
Expected: PASS

- [ ] **Step 3: 构建项目**

Run: `pnpm run build`
Expected: SUCCESS

- [ ] **Step 4: 手动测试关键功能**

测试以下场景:

```bash
# 测试 JSON 输出
node dist/bin/mark2pdf.js --json convert --dry-run

# 测试静默模式
node dist/bin/mark2pdf.js --quiet convert --dry-run

# 测试补全生成
node dist/bin/mark2pdf.js completion bash

# 测试 limit 标志
node dist/bin/mark2pdf.js --limit 5 convert --dry-run

# 测试弃用警告
node dist/bin/mark2pdf.js convert --format A4 --dry-run
```

Expected: 所有功能正常工作

- [ ] **Step 5: 提交最终测试**

```bash
git commit --allow-empty -m "test: verify all features work correctly"
```

---

## 自检清单

在完成所有任务后，检查以下项：

- [ ] 所有代码文件已创建/修改
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] 构建成功
- [ ] 手动测试通过
- [ ] 文档已更新
- [ ] CHANGELOG 已更新
- [ ] 版本号已升级
- [ ] 所有 commit 消息清晰明了
- [ ] 无 TODO 或占位符
