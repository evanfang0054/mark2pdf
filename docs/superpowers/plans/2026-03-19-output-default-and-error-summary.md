# mark2pdf 默认输出目录与最简失败摘要 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 CLI 核心调用方式的前提下，实现 `output/<cmd>` 默认输出策略、固定 `_latest-report.json` 诊断入口，以及一句话失败摘要。

**Architecture:** 通过“输出策略层 + 统一阶段跟踪 + 固定报告写入”改造 CLI。命令定义层负责参数接收与 `arg_parse` 失败拦截；`CLIHandler` 负责非参数解析阶段的执行、阶段标注、报告落盘与摘要输出。输出目录优先级固定为 `CLI -o/--output > config output.path > output/<cmd>`（仅 `convert/html/merge/extract` 生效）。保持核心转换/合并/提取服务不改动，遵循 KISS/YAGNI。

**Tech Stack:** TypeScript, Commander, Vitest, Node.js fs/path, chalk

---

## Scope & Decomposition Check

本次 spec 仅覆盖一个子系统（CLI 输出与诊断体验），无需拆分为多个实现计划。

## Relevant Skills to Apply During Execution

- `@superpowers:test-driven-development`
- `@superpowers:verification-before-completion`
- `@superpowers:requesting-code-review`

## File Map (create/modify)

### Create
- `src/cli/output-policy.ts` — 统一命令默认输出目录与固定报告路径策略
- `tests/unit/output.policy.test.ts` — 输出策略单测（命令映射、cwd 基准、`-o` 优先）

### Modify
- `src/bin/mark2pdf.ts` — 去掉 `--output` 硬编码默认值；新增 `arg_parse` 失败拦截与退出处理
- `src/cli/handler.ts` — 接入输出策略、阶段跟踪、固定 `_latest-report.json` 写入、失败一句话摘要
- `tests/unit/cli.test.ts` — 扩展 CLIHandler/CLI 行为测试（阶段枚举、固定报告路径、退出码语义）
- `README.md` / `README.zh-CN.md` — 更新默认输出目录与失败诊断说明

> 说明：本计划不修改 `src/config/schema.ts` 与 `src/config/loader.ts` 默认值，避免引入“配置默认 vs 命令默认”额外耦合。CLI 命令级默认输出由 `output-policy` 统一控制。

---

### Task 1: 建立输出策略层（默认目录与固定报告路径）

**Files:**
- Create: `src/cli/output-policy.ts`
- Test: `tests/unit/output.policy.test.ts`

- [ ] **Step 1: 写失败测试（命令映射 + cwd 基准 + `-o` 优先）**

```ts
expect(resolveDefaultOutputPath('convert', '/tmp/ws')).toBe('/tmp/ws/output/convert');
expect(resolveDefaultOutputPath('html', '/tmp/ws')).toBe('/tmp/ws/output/html');
expect(resolveDefaultOutputPath('merge', '/tmp/ws')).toBe('/tmp/ws/output/merge');
expect(resolveDefaultOutputPath('extract', '/tmp/ws')).toBe('/tmp/ws/output/extract');
expect(resolveEffectiveOutputPath('merge', './custom', '/tmp/ws')).toBe('./custom');
expect(resolveLatestReportPath('merge', '/tmp/ws')).toBe('/tmp/ws/output/merge/_latest-report.json');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest tests/unit/output.policy.test.ts`
Expected: FAIL（函数未实现）

- [ ] **Step 3: 实现最小策略函数**

```ts
export type SupportedCommand = 'convert' | 'html' | 'merge' | 'extract';
export function resolveDefaultOutputPath(command: SupportedCommand, cwd = process.cwd()): string;
export function resolveLatestReportPath(command: SupportedCommand, cwd = process.cwd()): string;
export function resolveEffectiveOutputPath(command: SupportedCommand, cliOutput?: string, cwd = process.cwd()): string;
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest tests/unit/output.policy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/output-policy.ts tests/unit/output.policy.test.ts
git commit -m "test(cli): add output policy mapping and report path resolution"
```

---

### Task 2: 处理 `arg_parse` 失败（Commander 层）

**Files:**
- Modify: `src/bin/mark2pdf.ts`
- Test: `tests/unit/cli.test.ts`

- [ ] **Step 1: 写失败测试（参数解析失败不写 latest report）**

```ts
// 伪代码：模拟 unknown option 触发 commander parse error
expect(exitCode).toBe(1);
expect(latestReportExists).toBe(false);
expect(stderr).toContain('invalid option');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest tests/unit/cli.test.ts -t "arg_parse"`
Expected: FAIL

- [ ] **Step 3: 在 `mark2pdf.ts` 实现解析错误拦截**

实现要点：
1. 使用 Commander 的解析异常控制（例如 `exitOverride`）拦截 `arg_parse` 错误
2. 对 `arg_parse` 仅打印参数错误与修复建议（`--help`），退出码 `1`
3. 明确不调用 latest report 写入逻辑（符合 spec）

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest tests/unit/cli.test.ts -t "arg_parse"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bin/mark2pdf.ts tests/unit/cli.test.ts
git commit -m "fix(cli): handle arg_parse failures without writing latest report"
```

---

### Task 3: 接入 handler 默认输出解析（`-o` 优先）

**Files:**
- Modify: `src/bin/mark2pdf.ts`
- Modify: `src/cli/handler.ts`
- Test: `tests/unit/cli.test.ts`

- [ ] **Step 1: 写失败测试（显式输出优先、未传时命令默认）**

```ts
expect(resolveEffectiveOutputPath('convert', './custom', '/tmp/ws')).toBe('./custom');
expect(handlerResolvedOutputFor('merge', undefined, '/tmp/ws')).toBe('/tmp/ws/output/merge');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest tests/unit/cli.test.ts -t "output default"`
Expected: FAIL

- [ ] **Step 3: 最小实现接入**

实现要点：
1. `mark2pdf.ts` 各命令 `--output` 移除默认值（保留 option 定义）
2. `CLIHandler.handleCommand` 在标准化后统一解析 `unifiedOptions.output`
3. 仅在 `convert/html/merge/extract` 应用命令默认目录，`init` 不涉及
4. 输出目录优先级锁定：`CLI -o/--output > config output.path > output/<cmd>`

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest tests/unit/cli.test.ts -t "output default"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bin/mark2pdf.ts src/cli/handler.ts tests/unit/cli.test.ts
git commit -m "feat(cli): apply command-scoped output defaults in handler"
```

---

### Task 4: 固定 `_latest-report.json` 与最小报告 schema

**Files:**
- Modify: `src/cli/handler.ts`
- Test: `tests/unit/cli.test.ts`

- [ ] **Step 1: 写失败测试（schema 字段 + 固定路径）**

```ts
expect(report).toMatchObject({
  runId: expect.any(String),
  command: 'convert',
  status: expect.stringMatching(/success|failed/),
  stage: expect.stringMatching(/arg_parse|input_validate|execute|write_output|write_report/),
  startedAt: expect.any(String),
  endedAt: expect.any(String),
  inputPath: expect.any(String),
  outputPath: expect.any(String),
});
expect(latestReportPath).toContain('output/convert/_latest-report.json');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest tests/unit/cli.test.ts -t "latest report"`
Expected: FAIL

- [ ] **Step 3: 实现报告模型与统一写入**

实现要点：
1. 新增内部 report 类型（对齐 spec 最小 schema）
2. `convert/html/merge/extract` 成功与失败（非 `arg_parse`）均写 latest report
3. 报告路径固定由 `resolveLatestReportPath(command)` 计算
4. `--report-json` 作为额外导出，不替代 latest report

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest tests/unit/cli.test.ts -t "latest report"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/handler.ts tests/unit/cli.test.ts
git commit -m "feat(cli): write fixed latest report with minimal schema"
```

---

### Task 5: 一句话摘要、阶段枚举、退出码语义

**Files:**
- Modify: `src/cli/handler.ts`
- Test: `tests/unit/cli.test.ts`

- [ ] **Step 1: 写失败测试（摘要与退出码）**

```ts
expect(successSummary).toMatch(/输出目录：.*output\/convert/);
expect(failureSummary).toContain('阶段：input_validate');
expect(failureSummary).toContain('output/convert/_latest-report.json');
expect(writeReportFailureMessage).toContain('write_report');
expect(writeReportFailureMessage).toContain('原始错误');
expect(exitCodeWhenWriteReportFailsAfterSuccess).toBe(1);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest tests/unit/cli.test.ts -t "summary|stage|exit code"`
Expected: FAIL

- [ ] **Step 3: 实现最小行为**

实现要点：
1. 阶段枚举固定：`arg_parse | input_validate | execute | write_output | write_report`
2. 成功摘要：一句话 + 输出目录（验证包含 `output/<cmd>`）
3. 失败摘要：一句话 + 固定报告路径 + 阶段枚举值
4. 报告写入失败时：终端输出原始错误并附加 `write_report` 失败说明
5. 主流程成功但写 latest report 失败：退出码 `1`

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest tests/unit/cli.test.ts -t "summary|stage|exit code"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/handler.ts tests/unit/cli.test.ts
git commit -m "feat(cli): standardize concise summaries and report failure exit code"
```

---

### Task 6: 文档更新（默认目录与诊断入口，可选）

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`

- [ ] **Step 1: 写文档断言检查清单（手工）**

检查点：
- 默认输出目录描述是否为 `output/<cmd>`
- 是否说明 `_latest-report.json` 固定路径
- 是否包含失败一句话示例

- [ ] **Step 2: 修改 README 中相关命令说明与 FAQ**

实现要点：
1. `convert/html/merge/extract` 默认输出路径更新
2. 增加失败定位指引：优先查看 `output/<cmd>/_latest-report.json`
3. 不新增超出 spec 的命令与功能描述

- [ ] **Step 3: 验证文档一致性**

Run: `pnpm test`（确保仅文档改动未破坏任何测试）
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add README.md README.zh-CN.md
git commit -m "docs(cli): document output command directories and latest report path"
```

---

### Task 7: 回归验证与交付检查（必须）

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: 运行完整测试集**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 2: 运行类型检查**

Run: `pnpm run type-check`
Expected: PASS

- [ ] **Step 3: 进行关键 CLI 手工冒烟**

Run:
```bash
pnpm run build
node dist/bin/mark2pdf.js --help
node dist/bin/mark2pdf.js html --help
node dist/bin/mark2pdf.js merge --help
node dist/bin/mark2pdf.js extract --help
```
Expected:
- `--help` 中输出参数仍可用
- 未传 `-o` 的命令执行路径可解析到 `output/<cmd>`（通过单测与执行日志验证）
- 失败摘要为一句话并给出固定报告路径

- [ ] **Step 4: 最终 Commit（若有验证修正）**

```bash
git add <only-fixes-from-verification>
git commit -m "chore(cli): finalize output policy and diagnostics verification"
```

---

## Risks & Mitigations

1. **风险：`arg_parse` 与 handler 错误处理边界混淆**
   - 缓解：Commander 层与 handler 层职责分离；分别测试。

2. **风险：报告写入失败导致状态误判**
   - 缓解：固定 `write_report` 阶段与退出码语义（主流程成功但写报告失败 => exit 1）。

3. **风险：`-o`、配置文件与命令默认值优先级不清导致行为不一致**
   - 缓解：在实现与测试中锁定优先级 `CLI -o/--output > config output.path > output/<cmd>`。

## Definition of Done

- `convert/html/merge/extract` 在未传 `-o` 时默认输出至 `output/<cmd>`
- 输出目录优先级为 `CLI -o/--output > config output.path > output/<cmd>`
- `_latest-report.json` 固定写入 `output/<cmd>/`，不受 `-o` 影响
- 失败摘要符合“一句话 + 报告路径”，阶段字段使用枚举值
- `arg_parse` 场景不写 `_latest-report.json`
- 报告写入失败时终端输出包含原始错误与 `write_report` 失败说明
- 测试、类型检查、关键冒烟全部通过
