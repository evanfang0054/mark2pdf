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

```json
{
  "error": "category",
  "message": "Error details",
  "hint": "mark2pdf command --flag"
}
```

`hint` 字段始终是可执行的命令。

## 标志弃用计划

| 旧标志 | 新标志 | 移除版本 |
|-------|-------|---------|
| `convert --format` | `convert --page-size` | v4.0.0 |
| `extract --format` | `extract --out-format` | v4.0.0 |

## 子命令

### convert

转换 Markdown/HTML 为 PDF 或提取文档。

**选项:**
- `-i, --input <path>`: 输入文件或目录
- `-o, --output <path>`: 输出目录
- `-c, --config <path>`: 配置文件路径
- `-t, --theme <name>`: PDF 主题
- `--concurrent <number>`: 并发数
- `--timeout <ms>`: 超时时间
- `--page-size <size>`: PDF 页面规格 (A4|Letter|A3|A5)
- `--out-format <format>`: 文本输出格式 (txt|md|json，仅 docx/pdf 提取)
- `--dry-run`: 仅输出执行计划，不创建文件
- `--show-config`: 打印最终生效配置及来源
- `--report-json <path>`: 输出结构化执行报告 JSON 文件

### html

转换 HTML 为 PDF。

### merge

合并 PDF 文件。

### extract

从 PDF/Word 文档提取文本。

**选项:**
- `-i, --input <path>`: 输入文件或目录
- `-o, --output <path>`: 输出目录
- `--out-format <format>`: 输出格式 (txt|md|json)

### init

初始化配置文件。

### completion

生成 shell 补全脚本。

**参数:**
- `[shell]`: shell 类型 (bash|zsh)，默认 bash
