# mark2pdf

[English](./README.md) | 简体中文

`mark2pdf` 是一个 Node.js CLI 工具，用于批量处理文档：

- Markdown → PDF
- HTML → PDF
- 多个 PDF 合并
- PDF / Word 文本提取

适用于文档发布、报告生成、资料归档等场景。

## 特性

- 支持文件与目录批量处理
- 可保持输出目录结构
- 支持并发与超时控制
- 支持 `dry-run`（仅预览执行计划）
- 支持结构化执行报告（JSON）
- 内置中文字体检测与回退
- 提供路径校验与详细错误日志

## 环境要求

- Node.js >= `16.15.0`
- pnpm（推荐）或 npm

## 安装

### 1）本地开发使用

```bash
git clone https://github.com/evanfang0054/mark2pdf.git
cd mark2pdf
pnpm install
pnpm run build
```

### 2）作为全局命令使用

```bash
# 在项目目录先构建
npm link

# 验证
mark2pdf --version
mark2pdf --help
```

### 3）直接用 npx

```bash
npx mark2pdf@latest --help
```

## 快速开始

### 转换 Markdown（默认命令）

```bash
mark2pdf convert -i ./docs -o ./dist/pdf
```

### 转换 HTML

```bash
mark2pdf html -i ./public/html -o ./dist/pdf
```

### 合并 PDF

```bash
mark2pdf merge -i ./dist/pdf -o ./dist/merged
```

### 提取文本

```bash
mark2pdf extract -i ./input -o ./output -f md
```

## CLI 命令

### `convert`（默认）

统一入口，会按输入类型自动分发转换/提取。

```bash
mark2pdf convert [options]
```

常用参数：

- `-i, --input <path>` 输入文件或目录（默认：`./public/md`）
- `-o, --output <path>` 输出目录（默认：`./dist/pdf`）
- `-c, --config <path>` 配置文件路径
- `--page-size <size>` 页面规格（`A4|Letter|A3|A5`）
- `--concurrent <n>` 并发数
- `--timeout <ms>` 超时（毫秒）
- `--out-format <format>` 提取输出格式（`txt|md|json`）
- `--dry-run` 仅输出执行计划
- `--show-config` 打印最终配置及来源
- `--report-json <path>` 输出结构化执行报告
- `--verbose` 详细日志

### `html`

```bash
mark2pdf html [options]
```

常用参数：

- `-i, --input <path>` 输入目录（默认：`./public/html`）
- `-o, --output <path>` 输出目录（默认：`./dist/pdf`）
- `-c, --config <path>` 配置文件路径
- `--format <type>` 页面格式（默认：`A4`）
- `--verbose` 详细日志

### `merge`

```bash
mark2pdf merge [options]
```

常用参数：

- `-i, --input <path>` 输入目录（默认：`./dist/pdf`）
- `-o, --output <path>` 输出目录（默认：`./dist/mergePdf`）
- `-c, --config <path>` 配置文件路径
- `--verbose` 详细日志

### `extract`

```bash
mark2pdf extract [options]
```

常用参数：

- `-i, --input <path>` 输入文件或目录（默认：`./input`）
- `-o, --output <path>` 输出目录（默认：`./output`）
- `-f, --format <format>` 输出格式（`txt|md|json`）
- `--verbose` 详细日志

### `init`

```bash
mark2pdf init [options]
```

常用参数：

- `-g, --global` 创建全局配置

## 配置文件

默认按功能拆分为：

- `config.json`：Markdown → PDF
- `html2pdf.config.json`：HTML → PDF
- `merge.config.json`：PDF 合并

示例（`config.json`）：

```json
{
  "input": {
    "path": "./public/md",
    "extensions": [".md"]
  },
  "output": {
    "path": "./public_dist/pdf",
    "createDirIfNotExist": true,
    "maintainDirStructure": true
  },
  "options": {
    "concurrent": 3,
    "timeout": 30000,
    "format": "A4",
    "orientation": "portrait"
  }
}
```

## 开发

### 常用脚本

```bash
pnpm run build         # 构建
pnpm run build:watch   # 监听构建
pnpm test              # 运行测试
pnpm run test:coverage # 覆盖率报告
pnpm run type-check    # 类型检查
pnpm run clean         # 清理 dist/coverage
```

### 项目结构（精简）

```text
src/
  bin/        # CLI 入口
  cli/        # 命令处理
  core/       # 核心转换与合并逻辑
  services/   # 服务层
  config/     # 配置加载与校验
  utils/      # 工具函数
tests/        # 测试
assets/       # 静态资源（样式/字体）
```

## 常见问题

### 执行后没有输出文件

先执行：

```bash
mark2pdf convert --show-config --verbose
```

确认输入路径、输出路径和扩展名过滤是否正确。

### 中文显示异常

项目会自动检测系统字体并回退。若仍异常，请确认系统已安装可用中文字体，或在 `assets` 下提供字体文件。

### 批量处理较慢

可调整并发，例如：

```bash
mark2pdf convert --concurrent 4
```

并发过高可能带来更高内存压力。

## 兼容说明

- `convert` 中的 `--format` 为兼容参数。
- 新用法建议使用 `--page-size`。

## License

ISC
