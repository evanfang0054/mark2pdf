# mark2pdf

一个功能强大的 Markdown 转 PDF 工具，支持批量转换和 PDF 合并功能。基于 Node.js 构建，提供高度可配置的文档转换解决方案。

## ✨ 主要特性

- 🚀 批量转换 Markdown 文件为 PDF
- 🌐 支持 HTML 文件转换为 PDF
- 📦 支持 PDF 文件合并
- 🎯 灵活的配置选项
- 📁 保持原始目录结构
- 🔄 并发处理提升效率
- 🎨 自定义 PDF 样式和布局
- 📊 详细的转换日志
- 🔍 智能文件过滤
- 🛡️ 健壮的错误处理机制
- 🧠 内存使用监控
- 🔒 完整的路径验证和安全检查
- 🧪 全面的单元测试和集成测试
- 📝 详细的类型定义和文档
- 🌏 完整的中文字体支持
- 🔤 HTML 实体编码自动解码

## 🚀 快速开始

### 环境要求

- Node.js >= 16.15.0
- pnpm (推荐) 或 npm

### 安装

```bash
# 克隆项目
git clone https://github.com/evanfang0054/mark2pdf.git
cd mark2pdf

# 安装依赖
pnpm install

# 构建项目
pnpm run build
```

### 基本使用

#### 开发环境使用
```bash
# 转换 Markdown 为 PDF
pnpm run start

# 转换 HTML 为 PDF
pnpm run html2pdf

# 合并 PDF 文件
pnpm run merge

# 运行测试
pnpm test

# 类型检查
pnpm run type-check

# 构建项目
pnpm run build
```

#### 全局使用
```bash
# 构建项目后，可以使用 mark2pdf 命令
pnpm run build

# 创建全局链接（可选）
npm link

# 然后可以直接使用 mark2pdf 命令
mark2pdf --version
mark2pdf --help
mark2pdf convert
mark2pdf html
mark2pdf merge
```

#### 安装为全局工具
```bash
# 在项目目录下构建
pnpm run build

# 创建全局链接（可选）
npm link
```

或者直接使用：
```bash
# 使用 npx 运行
npx mark2pdf@latest convert -i ./docs -o ./output
```

## 📖 详细使用指南

### 1. 安装和初始化

#### 1.1 安装依赖
```bash
# 克隆项目
git clone https://github.com/evanfang0054/mark2pdf.git
cd mark2pdf

# 安装依赖
pnpm install
```

#### 1.2 初始化配置
```bash
# 使用 CLI 向导初始化配置
mark2pdf init

# 或者手动创建配置文件
mark2pdf init --config ./my-config.json
```

### 2. CLI 工具使用

#### 2.1 基本命令
```bash
# 查看版本
mark2pdf --version

# 查看帮助
mark2pdf --help

# 查看子命令帮助
mark2pdf convert --help
mark2pdf html --help
mark2pdf merge --help
```

#### 2.2 统一入口 `convert`（按输入类型自动分发）
```bash
# 使用默认配置转换（默认输入 ./public/md）
mark2pdf convert

# 指定输入输出目录（目录或单文件都可）
mark2pdf convert -i ./docs -o ./output

# 指定页面规格（用于 PDF 输出）
mark2pdf convert --page-size A4

# 文本提取输出格式（用于 docx/pdf 提取）
mark2pdf convert -i ./input --out-format md

# 仅生成执行计划，不产生任何文件
mark2pdf convert -i ./docs --dry-run

# 打印最终生效配置及来源
mark2pdf convert --show-config

# 输出结构化执行报告 JSON
mark2pdf convert --report-json ./dist/report.json

# 启用详细输出
mark2pdf convert --verbose

# 兼容旧参数（会提示弃用）
mark2pdf convert --format A4
```

#### 2.3 转换 HTML 为 PDF
```bash
# 使用默认配置转换 HTML
mark2pdf html

# 指定输入输出目录
mark2pdf html -i ./html-files -o ./pdf-output

# 指定页面格式
mark2pdf html --format A4

# 启用详细输出
mark2pdf html --verbose
```

#### 2.4 合并 PDF 文件
```bash
# 使用默认配置合并 PDF
mark2pdf merge

# 指定输入输出目录
mark2pdf merge -i ./pdf-files -o ./merged-output

# 启用文件排序
mark2pdf merge --sort-enabled true --sort-method name --sort-direction asc

# 启用压缩
mark2pdf merge --compression-enabled true --compression-quality high

# 覆盖已存在文件
mark2pdf merge --overwrite true
```

### 3. 配置文件详解

#### 3.1 配置文件位置
- **主配置**: `config.json` (Markdown 转 PDF)
- **HTML 配置**: `html2pdf.config.json` (HTML 转 PDF)
- **合并配置**: `merge.config.json` (PDF 合并)

#### 3.2 配置文件示例

##### Markdown 转 PDF 配置 (config.json)
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
  },
  "features": {
    "incremental": false
  }
}
```

##### HTML 转 PDF 配置 (html2pdf.config.json)
```json
{
  "input": {
    "path": "./public/html",
    "extensions": [".html"]
  },
  "output": {
    "path": "./public_dist/pdf",
    "createDirIfNotExist": true,
    "maintainDirStructure": true
  },
  "options": {
    "format": "A4",
    "margin": {
      "top": "1cm",
      "right": "1cm",
      "bottom": "1cm",
      "left": "1cm"
    },
    "printBackground": true,
    "scale": 1,
    "landscape": false,
    "pageRanges": "",
    "headerTemplate": "",
    "footerTemplate": "",
    "timeout": 30000
  }
}
```

##### PDF 合并配置 (merge.config.json)
```json
{
  "input": {
    "path": "./public_dist/pdf",
    "extensions": [".pdf"]
  },
  "output": {
    "path": "./public_dist/mergePdf",
    "createDirIfNotExist": true
  },
  "options": {
    "sort": {
      "enabled": true,
      "method": "name",
      "direction": "asc"
    },
    "compression": {
      "enabled": true,
      "quality": "medium"
    },
    "overwrite": true
  }
}
```

### 4. 实际使用场景

#### 4.1 批量转换文档
```bash
# 转换整个项目的文档
mark2pdf convert -i ./project-docs -o ./project-pdfs

# 并发处理提高效率
mark2pdf convert --concurrent 8
```

#### 4.2 生成技术文档 PDF
```bash
# 新参数：页面规格（推荐）
mark2pdf convert --page-size A4

# 旧参数兼容：仍可运行，但会提示弃用
mark2pdf convert --format A4

# 设置并发数和超时
mark2pdf convert --concurrent 5 --timeout 60000

# 先查看执行计划（无副作用）
mark2pdf convert -i ./project-docs --dry-run
```

#### 4.3 合并多个 PDF
```bash
# 合并章节 PDF 为完整文档
mark2pdf merge -i ./chapters -o ./complete-book.pdf

# 合并时输出详细日志
mark2pdf merge --verbose
```

### 5. 高级功能

#### 5.1 过滤器和通配符
```json
{
  "input": {
    "path": "./docs",
    "extensions": [".md"],
    "filters": {
      "include": [".*.md"],
      "exclude": ["*draft*", "*temp*"]
    }
  }
}
```

#### 5.2 自定义样式
```css
/* assets/custom-style.css */
@page {
  size: A4;
  margin: 2cm;
}

body {
  font-family: 'Arial', sans-serif;
  line-height: 1.6;
}

h1 {
  color: #333;
  border-bottom: 2px solid #333;
}

code {
  background-color: #f4f4f4;
  padding: 2px 4px;
}
```

#### 5.3 环境变量配置
```bash
# .env 文件
MARK2PDF_INPUT_PATH=./docs
MARK2PDF_OUTPUT_PATH=./output
MARK2PDF_CONCURRENT=4
MARK2PDF_TIMEOUT=60000
```

### 6. 故障排除

#### 6.1 常见问题
```bash
# 检查配置文件
mark2pdf convert --verbose

# 验证输入输出路径
mark2pdf convert --input ./docs --output ./output

# 检查文件权限
ls -la ./docs ./output
```

#### 6.2 调试模式
```bash
# 启用详细输出
mark2pdf convert --verbose

# 检查配置加载与来源
mark2pdf convert --show-config

# 同步输出结构化报告，便于 CI/脚本消费
mark2pdf convert --report-json ./dist/report.json
```

### 7. 性能优化

#### 7.1 批量处理优化
```bash
# 根据系统性能调整并发数
mark2pdf convert --concurrent 4

# 启用增量转换
mark2pdf convert --config ./config.json  # 在配置文件中设置 "incremental": true

# 启用重试机制
mark2pdf convert --config ./config.json  # 在配置文件中设置 "features.retry": 2
```

#### 7.2 内存优化
```bash
# 限制并发数减少内存使用
mark2pdf convert --concurrent 2

# 设置较短的超时时间
mark2pdf convert --timeout 15000
```

### 8. 自动化脚本

#### 8.1 构建脚本示例
```bash
#!/bin/bash
# build-docs.sh

echo "开始构建文档..."

# 转换 Markdown 为 PDF
mark2pdf convert -i ./docs -o ./dist/pdfs

# 转换 HTML 为 PDF
mark2pdf html -i ./html -o ./dist/pdfs

# 合并所有 PDF
mark2pdf merge -i ./dist/pdfs -o ./dist/final.pdf

echo "文档构建完成！"
```

#### 8.2 监控脚本
```bash
#!/bin/bash
# monitor-conversion.sh

while true; do
    echo "检查新文件..."
    find ./docs -name "*.md" -newer ./last-conversion -exec mark2pdf convert {} \;
    touch ./last-conversion
    sleep 60
done
```

## ⚙️ 配置说明

### Markdown 转 PDF 配置

在 `config.json` 中配置：

```json
{
  "input": {
    "path": "./public/md",      // Markdown 文件目录
    "extensions": [".md"]       // 支持的文件扩展名
  },
  "output": {
    "path": "./dist/pdf",       // 输出目录
    "createDirIfNotExist": true,  // 自动创建目录
    "maintainDirStructure": true  // 保持目录结构
  },
  "options": {
    "concurrent": 3,            // 并发处理数量
    "timeout": 30000,          // 处理超时时间（毫秒）
    "format": "A4",            // 页面格式
    "orientation": "portrait"   // 页面方向
  }
}
```

### HTML 转 PDF 配置

在 `html2pdf.config.json` 中配置：

```json
{
  "input": {
    "path": "./public/html",    // HTML 文件目录
    "extensions": [".html"]     // 支持的文件扩展名
  },
  "output": {
    "path": "./dist/pdf",       // 输出目录
    "createDirIfNotExist": true,  // 自动创建目录
    "maintainDirStructure": true  // 保持目录结构
  },
  "options": {
    "format": "A4",            // 页面格式 (A4, Letter 等)
    "margin": {                // 页面边距
      "top": "1cm",
      "right": "1cm",
      "bottom": "1cm",
      "left": "1cm"
    },
    "printBackground": true,    // 是否打印背景
    "scale": 1,                // 缩放比例
    "landscape": false,         // 是否横向打印
    "pageRanges": "",          // 页面范围 (例如: "1-5, 8")
    "headerTemplate": "",      // 页眉模板
    "footerTemplate": "",      // 页脚模板
    "timeout": 30000           // 超时时间 (毫秒)
  }
}
```

### PDF 合并配置

在 `merge.config.json` 中配置：

```json
{
  "input": {
    "path": "./dist/pdf",      // PDF 文件目录
    "extensions": [".pdf"]     // 文件扩展名
  },
  "output": {
    "path": "./dist/mergePdf", // 输出目录
    "createDirIfNotExist": true // 自动创建目录
  },
  "options": {
    "sort": {
      "enabled": true,         // 启用排序
      "method": "name",        // 排序方式：name/date/size
      "direction": "asc"       // 排序方向：asc/desc
    },
    "compression": {
      "enabled": true,         // 启用压缩
      "quality": "medium"      // 压缩质量：low/medium/high
    },
    "overwrite": true          // 覆盖已存在文件
  }
}
```

### 样式自定义

通过修改 `assets/pdf-style.css` 文件，可以自定义 PDF 输出样式：

- 字体、颜色和间距
- 标题和段落样式
- 表格、代码块和引用样式
- 页眉页脚设置
- 分页控制

### 中文字体支持

项目内置完整的中文字体支持系统，自动检测和使用系统字体：

**支持的字体格式：**
- TrueType 字体 (.ttf)
- TrueType Collection (.ttc)

**自动字体检测优先级：**
1. 项目内字体：`assets/fonts/SimHei.ttf`、`MicrosoftYaHei.ttf`、`PingFang.ttf`
2. macOS 系统字体：`PingFang.ttc`、`Hiragino Sans GB.ttc`、`STHeiti.ttc`
3. Windows 系统字体：`msyh.ttf`、`simhei.ttf`、`arialuni.ttf`
4. Linux 系统字体：`wqy-microhei.ttc`、`wqy-zenhei.ttc`

**字体回退机制：**
- 自动检测系统字体并加载
- 字体加载失败时回退到 Helvetica
- 提供详细的字体加载日志

### HTML 实体解码

项目内置完整的 HTML 实体解码功能，确保代码块和特殊字符正确显示：

**支持的实体类型：**
- 十六进制实体：`&#x1F600;` → 😄
- 十进制实体：`&#169;` → ©
- 命名实体：`&copy;` → ©、`&nbsp;` → 空格

**支持的常见实体：**
- 引号：`&quot;` → `"`、`&apos;` → `'`、`&#39;` → `'`
- 比较符号：`&lt;` → `<`、`&gt;` → `>`
- 特殊符号：`&copy;`、`&reg;`、`&trade;`、`&euro;`、`&pound;`、`&yen;`
- 数学符号：`&deg;`、`&plusmn;`、`&times;`、`&divide;`
- 空格：`&nbsp;` → 空格

**使用场景：**
- 代码块中的引号和特殊字符
- 数学公式和科学符号
- 版权和商标符号
- Unicode 表情符号
- 多语言文本内容

## 🔍 高级功能

### 文件过滤

- 支持通配符模式排除文件
- 基于文件大小的过滤
- 目录级别的排除

### 性能优化

- 并发处理提升转换效率
- 文件压缩选项
- 可配置的超时处理
- 内存使用监控

### 错误处理

- 详细的错误日志记录
- 转换失败时的错误报告
- 全局异常捕获机制
- 优雅退出处理

## 📝 最佳实践

1. **配置优化**
   - 根据机器性能调整并发数
   - 合理设置超时时间
   - 按需配置压缩选项

2. **目录结构**
   - 保持 Markdown 文件组织整洁
   - 使用有意义的文件命名
   - 避免过深的目录层级

3. **性能建议**
   - 大量文件转换时适当降低并发数
   - 对大文件考虑启用压缩
   - 定期清理临时文件

4. **样式定制**
   - 使用 CSS 变量简化样式管理
   - 针对特定内容类型优化样式
   - 测试不同设备上的渲染效果

## 🏗️ 架构设计

### 核心模块

- **配置管理**：处理配置文件加载和验证
- **转换引擎**：负责 Markdown 到 PDF 的转换（使用 pdfkit）
- **合并引擎**：处理多个 PDF 文件的合并（使用 pdf-lib）
- **服务层**：协调批量处理和资源管理
- **工具类**：提供文件操作、日志记录等通用功能

### 设计模式

- **工厂模式**：创建转换器和合并器实例
- **策略模式**：支持不同的排序和过滤策略
- **观察者模式**：通过事件机制处理异步操作
- **单例模式**：配置和日志管理

### 数据流

``` bash
配置加载 → 文件扫描 → 批量处理 → 转换/合并 → 输出结果
```

## 🧩 技术栈

### 核心依赖
- `pdfkit`: Markdown 转 PDF 引擎
- `pdf-lib`: PDF 操作和合并
- `marked`: Markdown 解析器
- `commander`: 命令行参数解析
- `chalk` & `ora`: 终端输出美化
- `zod`: 数据验证和类型安全

### 开发工具
- **构建工具**: esbuild + TypeScript
- **测试框架**: Vitest + Istanbul 覆盖率
- **包管理**: pnpm
- **运行时**: Node.js >= 16.15.0
- **路径别名**: 支持 `@/` 别名导入

### 开发依赖
- `tsx`: TypeScript 执行器
- `typescript`: 类型系统
- `vitest`: 测试框架
- `@vitest/coverage-istanbul`: 覆盖率报告
- `esbuild`: 高性能构建工具
- `dotenv`: 环境变量管理

## 🔧 开发指南

### 项目结构

``` bash
├── assets/                    # 静态资源
│   └── pdf-style.css          # PDF 样式文件
├── config.json                # 转换配置
├── html2pdf.config.json       # HTML转PDF配置
├── merge.config.json          # 合并配置
├── public/                    # 示例资源目录
│   ├── md/                    # Markdown 文件示例目录
│   └── html/                  # HTML 文件示例目录
├── public_dist/               # 默认输出目录
│   ├── pdf/                   # PDF 输出目录
│   └── mergePdf/              # 合并PDF输出目录
├── src/                       # 源代码
│   ├── bin/                   # CLI 工具
│   │   └── mark2pdf.ts        # 主入口文件
│   ├── config/                # 配置管理
│   │   ├── index.ts           # 配置导出
│   │   ├── loader.ts          # 配置加载器
│   │   ├── migrator.ts        # 配置迁移
│   │   └── schema.ts          # 配置模式定义
│   ├── core/                  # 核心功能
│   │   ├── PdfConverter.ts    # PDF 转换器
│   │   └── PdfMerger.ts       # PDF 合并器
│   ├── scripts/               # 脚本入口
│   │   ├── convert.ts         # Markdown转PDF入口
│   │   ├── html2pdf.ts        # HTML转PDF入口
│   │   └── merge.ts           # PDF合并入口
│   ├── services/              # 服务层
│   │   ├── converter.ts       # 转换服务
│   │   └── merger.ts          # 合并服务
│   ├── utils/                 # 工具函数
│   │   ├── EventEmitter.ts    # 事件发射器
│   │   ├── fileUtils.ts       # 文件操作工具
│   │   ├── logger.ts          # 日志记录
│   │   ├── pathUtils.ts       # 路径工具
│   │   ├── pathValidator.ts   # 路径验证
│   │   └── progress.ts        # 进度显示
│   └── cli/                   # CLI 命令处理
│       ├── handler.ts         # 命令处理器
│       └── setup-wizard.ts    # 设置向导
├── tests/                     # 测试文件
│   ├── setup.ts               # 测试设置
│   └── unit/                  # 单元测试
│       ├── config.loader.test.ts
│       ├── converter.test.ts
│       ├── path.validator.test.ts
│       ├── config.paths.test.ts
│       ├── cli.test.ts
│       └── config.schema.test.ts
├── dist/                      # 构建输出
│   ├── bin/                   # CLI 工具
│   ├── types/                 # 类型定义
│   └── assets/                # 静态资源
├── coverage/                  # 覆盖率报告
├── package.json               # 项目配置
├── tsconfig.json              # TypeScript 配置
├── vitest.config.ts           # 测试配置
└── build.js                   # 构建脚本
```

### 扩展指南

1. **添加新功能**
   - 在 `src/core` 中实现核心逻辑
   - 在 `src/services` 中添加服务层封装
   - 更新配置模式以支持新选项

2. **自定义转换器**
   - 继承 `PdfConverter` 类
   - 重写 `convert` 方法
   - 在服务层中使用新的转换器

3. **插件系统**
   - 实现插件加载机制
   - 定义插件接口和生命周期钩子
   - 支持第三方插件扩展功能

4. **字体支持扩展**
   - 在 `PdfConverter.ts` 的 `_getChineseFontInfo()` 方法中添加新字体路径
   - 支持更多字体格式和编码
   - 添加字体验证和兼容性检查

5. **HTML 实体解码扩展**
   - 在 `PdfConverter.ts` 的 `_decodeHtmlEntities()` 方法中添加新的实体类型
   - 支持更多 Unicode 字符和符号
   - 优化解码性能和错误处理

### 调试技巧

- 使用 `logger.setLevel('debug')` 启用详细日志
- 监控内存使用情况以优化大文件处理
- 使用 Node.js 调试工具分析性能瓶颈
- 测试字体加载和 HTML 实体解码功能
- 验证路径验证和安全检查机制

## 🧪 测试和质量保证

### 测试覆盖

项目包含全面的测试套件，确保代码质量和功能稳定性：

- **单元测试**: 62个测试用例，覆盖所有核心功能
- **集成测试**: 验证整个系统的工作流程
- **路径验证测试**: 确保文件操作的安全性
- **配置加载测试**: 验证配置文件解析和验证
- **CLI工具测试**: 验证命令行接口功能

### 运行测试

```bash
# 运行所有测试
pnpm test

# 生成覆盖率报告
pnpm run test:coverage

# 运行UI测试界面
pnpm run test:ui
```

### 代码质量检查

```bash
# TypeScript 类型检查
pnpm run type-check

# 构建项目
pnpm run build

# 清理构建文件
pnpm run clean
```

### 测试架构

- **测试框架**: Vitest
- **覆盖率报告**: Istanbul
- **Mock设置**: 完整的依赖模拟
- **路径别名**: 支持 `@/` 别名导入
- **环境隔离**: 独立的测试环境配置

## 🔒 安全特性

### 路径验证系统

- **路径遍历防护**: 防止 `../` 攻击
- **安全路径检查**: 排除危险系统目录
- **权限验证**: 检查文件读写权限
- **格式验证**: 确保路径格式正确

### 输入验证

- **配置验证**: 使用 Zod 进行严格验证
- **文件扩展名验证**: 确保只处理允许的文件类型
- **边界检查**: 防止缓冲区溢出
- **类型安全**: 完整的 TypeScript 类型定义

### 错误处理

- **全局异常捕获**: 防止未处理的异常
- **优雅降级**: 在错误情况下保持功能可用
- **详细日志**: 便于问题诊断和调试
- **资源清理**: 确保临时文件正确清理
