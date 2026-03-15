---
name: mark2pdf
description: |
  专业的 Markdown 转 PDF 工具。当用户需要转换 Markdown 文档为 PDF、合并 PDF 文件、或进行 HTML 转 PDF 时使用。
  触发场景：markdown转pdf、md转pdf、md文件转换、批量转换markdown、合并pdf、html转pdf、pdf合并、文档转换、生成pdf。

---

# mark2pdf 技能

将 Markdown 文档批量转换为 PDF 的专业工具。

## 快速开始

```bash
# 转换 Markdown 为 PDF（默认命令）
mark2pdf -i ./docs -o ./output

# 转换 HTML 为 PDF
mark2pdf html -i ./html -o ./output

# 合并 PDF 文件
mark2pdf merge -i ./pdfs -o ./merged.pdf

# 初始化配置文件
mark2pdf init
```

## CLI 命令

### `convert` (默认)

转换 Markdown 文件为 PDF。

```bash
mark2pdf convert [选项]
```

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--input` | `-i` | 输入目录 | `./public/md` |
| `--output` | `-o` | 输出目录 | `./dist/pdf` |
| `--config` | `-c` | 配置文件路径 | - |
| `--theme` | `-t` | 主题名称 | - |
| `--concurrent` | | 并发数 (1-10) | 3 |
| `--timeout` | | 超时时间 (ms) | 30000 |
| `--format` | | 页面格式 | A4 |
| `--verbose` | | 详细输出 | false |

### `html`

转换 HTML 文件为 PDF。

```bash
mark2pdf html [选项]
```

### `merge`

合并多个 PDF 文件。

```bash
mark2pdf merge [选项]
```

### `init`

初始化配置文件。

```bash
mark2pdf init          # 当前目录
mark2pdf init --global # 全局配置 (~/.mark2pdf/)
```

## 配置文件

项目根目录创建 `config.json`：

```json
{
  "input": {
    "path": "./docs",
    "extensions": [".md"],
    "filters": {
      "include": ["draft-*"],
      "exclude": ["temp-*"]
    }
  },
  "output": {
    "path": "./dist/pdf",
    "createDirIfNotExist": true,
    "maintainDirStructure": true
  },
  "options": {
    "concurrent": 3,
    "timeout": 30000,
    "format": "A4",
    "orientation": "portrait",
    "overwrite": false
  },
  "features": {
    "incremental": true,
    "retry": 2,
    "cache": true
  }
}
```

## 常用工作流程

### 批量转换文档

```bash
# 1. 初始化配置
mark2pdf init

# 2. 编辑 config.json 设置输入输出路径

# 3. 执行转换
mark2pdf --verbose
```

### 合并多个 PDF

```bash
# 先转换，再合并
mark2pdf -i ./docs -o ./pdfs
mark2pdf merge -i ./pdfs -o ./final.pdf
```

### 高并发处理大量文件

```bash
mark2pdf --concurrent 8 --timeout 60000
```

## 中文字体支持

自动检测系统字体：
- macOS: PingFang.ttc, Hiragino Sans GB.ttc
- Windows: msyh.ttf (微软雅黑)
- Linux: wqy-microhei.ttc

也可将字体文件放到 `assets/fonts/` 目录。

## 项目位置

**路径**: `/Users/arwen/Desktop/Arwen/evanfang/mark2pdf`

**构建后运行**:
```bash
pnpm run build
node dist/bin/mark2pdf.js --help
```

**开发模式运行**:
```bash
pnpm run start
```
