# Design: 多格式输入输出支持

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI 入口                               │
│                   mark2pdf convert/extract/merge                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        统一转换器                               │
│                    UnifiedConverterService                            │
│  - detectInputType(filePath) -> 'docx' | 'pdf' | 'md' | 'html'  │
│  - convert(input, output, format) -> 根据类型选择处理器          │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  DocxConverter   │ │  PdfExtractor    │ │  MdConverter     │
│  (mammoth)       │ │  (pdf-parse)     │ │  (现有实现)       │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## 新增依赖

```json
{
  "dependencies": {
    "mammoth": "^1.x",      // Word 解析
    "pdf-parse": "^1.x"    // PDF 文本提取
  }
}
```

## 模块设计

### 1. 输入检测器 (src/utils/inputDetector.ts)

```typescript
type InputType = 'md' | 'html' | 'docx' | 'pdf';

function detectInputType(filePath: string): InputType {
  const ext = path.extname(filePath).toLowerCase();
  const typeMap = {
    '.md': 'md',
    '.markdown': 'md',
    '.html': 'html',
    '.htm': 'html',
    '.docx': 'docx',
    '.pdf': 'pdf'
  };
  return typeMap[ext] || 'md';
}
```

### 2. 输出格式处理器 (src/utils/outputFormatter.ts)

```typescript
type OutputFormat = 'pdf' | 'txt' | 'md' | 'json';

interface FormattedOutput {
  content: string;
  metadata?: {
    title?: string;
    sections?: Section[];
    wordCount?: number;
  };
}

function formatOutput(content: string, format: OutputFormat): string | Buffer {
  switch (format) {
    case 'txt': return content;
    case 'md': return toMarkdown(content);
    case 'json': return toJSON(content);
    case 'pdf': return toPDF(content);
  }
}
```

### 3. Word 转换器 (src/core/DocxConverter.ts)

```typescript
import mammoth from 'mammoth';

class DocxConverter {
  // .docx -> 纯文本/Markdown
  async extractText(filePath: string): Promise<string>

  // .docx -> HTML
  async extractHtml(filePath: string): Promise<string>

  // 批量处理
  async convertBatch(files: string[], options: ConvertOptions): Promise<ConversionResult[]>
}
```

### 4. PDF 提取器 (src/core/PdfExtractor.ts)

```typescript
import pdfParse from 'pdf-parse';

class PdfExtractor {
  // 提取纯文本
  async extractText(filePath: string): Promise<string>

  // 尝试识别标题结构（基于字体大小启发式）
  async extractStructured(filePath: string): Promise<StructuredContent>

  // 批量处理
  async extractBatch(files: string[]): Promise<ExtractionResult[]>
}
```

## CLI 命令设计

### 现有命令扩展

```bash
# Markdown 转 PDF（现有）
mark2pdf convert ./docs -o ./output

# 新增：指定输出格式
mark2pdf convert ./docs -o ./output --format txt
mark2pdf convert ./docs -o ./output --format json
```

### 新增 extract 命令

```bash
# 从 PDF 提取文本
mark2pdf extract ./input.pdf -o ./output.txt
mark2pdf extract ./input.pdf -o ./output.md --format md

# 批量提取
mark2pdf extract ./pdfs -o ./extracted --format txt
```

### 统一 convert 命令（自动检测输入类型）

```bash
# 自动检测类型并转换
mark2pdf convert ./document.docx -o ./output.pdf
mark2pdf convert ./document.docx -o ./output.txt --format txt
```

## 配置扩展

```json
// config.json
{
  "input": {
    "path": "./docs",
    "extensions": [".md", ".docx", ".pdf", ".html"]  // 扩展支持
  },
  "output": {
    "path": "./output",
    "format": "pdf"  // 新增：默认输出格式
  },
  "options": {
    // ... 现有选项
  }
}
```

## 文件结构变更

```
src/
├── core/
│   ├── PdfConverter.ts     # 现有
│   ├── PdfMerger.ts        # 现有
│   ├── DocxConverter.ts    # 新增
│   └── PdfExtractor.ts     # 新增
├── services/
│   ├── converter.ts        # 现有
│   ├── UnifiedConverter.ts # 新增：统一入口
│   └── htmlConverter.ts    # 现有
├── utils/
│   ├── inputDetector.ts    # 新增
│   └── outputFormatter.ts  # 新增
└── cli/
    └── handler.ts          # 扩展
```
