# mark2pdf

[English](./README.md) | 简体中文

`mark2pdf` 是一个简单的 Node.js CLI，适合批量文档处理：

- Markdown → PDF
- HTML → PDF
- 多个 PDF 合并
- PDF / Word 文本提取

## 适用场景

当你希望用一个命令行工具完成转换、合并、提取等文档流水线任务时使用。

## 环境要求

- Node.js >= `16.15.0`
- pnpm（推荐）或 npm

## 安装

```bash
git clone https://github.com/evanfang0054/mark2pdf.git
cd mark2pdf
pnpm install
pnpm run build
```

可选：注册全局命令

```bash
npm link
mark2pdf --help
```

## 快速开始

```bash
# Markdown / 统一转换入口
mark2pdf convert -i ./docs

# HTML 转 PDF
mark2pdf html -i ./public/html

# 合并 PDF
mark2pdf merge -i ./dist/pdf

# 文本提取
mark2pdf extract -i ./input -f md
```

## 命令说明

### convert（默认命令）

```bash
mark2pdf convert [options]
```

常用参数：

- `-i, --input <path>` 输入文件或目录（默认：`./public/md`）
- `-o, --output <path>` 输出目录（未传时：`./output/convert`）
- `-c, --config <path>` 配置文件路径
- `--page-size <size>` 页面规格：`A4|Letter|A3|A5`
- `--concurrent <n>` 并发数
- `--timeout <ms>` 超时
- `--out-format <format>` 提取格式：`txt|md|json`
- `--dry-run` 仅打印执行计划
- `--show-config` 打印最终配置及来源
- `--report-json <path>` 输出结构化 JSON 报告
- `--verbose` 详细日志

## 全局标志

- `--json`: 结构化 JSON 输出（Agent 模式）
- `--no-color`: 禁用颜色输出
- `-q, --quiet`: 静默模式（仅输出错误）
- `-v, --verbose`: 详细日志
- `--no-input`: 禁用交互式提示
- `--limit <n>`: 最大处理文件数（默认 50，0 表示无限制）

## 配置优先级

配置按以下优先级从高到低加载：

1. **命令行参数**（例如：`--input ./docs`）
2. **环境变量**（`MARK2PDF_INPUT_PATH`、`MARK2PDF_OUTPUT_PATH`）
3. **项目配置文件**（`./mark2pdf.config.json`、`./config.json`）
4. **用户配置文件**（`~/.mark2pdf/config.json`）
5. **默认值**

详见 [docs/cli-spec.md](./docs/cli-spec.md)。

## 输出与报告（KISS）

- 默认输出根目录：`./output/<command>`
- 最近一次执行报告：`./output/<command>/_latest-report.json`
- 也可以通过 `--output` 指定自定义输出目录

## 配置文件

- `config.json`：Markdown 转 PDF
- `html2pdf.config.json`：HTML 转 PDF
- `merge.config.json`：PDF 合并

## 开发脚本

```bash
pnpm run build
pnpm test
pnpm run type-check
pnpm run clean
```

## License

ISC
