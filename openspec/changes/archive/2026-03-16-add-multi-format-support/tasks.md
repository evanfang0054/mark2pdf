# Tasks: 多格式输入输出支持

## 状态说明

- [ ] 待开始
- [~] 进行中
- [x] 已完成

---

## Phase 1: 基础设施

### Task 1.1: 添加依赖
- [x] 安装 `mammoth` 和 `pdf-parse`
- [x] 更新 package.json

### Task 1.2: 创建输入检测器
- [x] 创建 `src/utils/inputDetector.ts`
- [x] 实现 `detectInputType()` 函数
- [x] 添加单元测试

### Task 1.3: 创建输出格式化器
- [x] 创建 `src/utils/outputFormatter.ts`
- [x] 实现 txt/md/json 格式输出
- [x] 添加单元测试

---

## Phase 2: Word 支持

### Task 2.1: 实现 DocxConverter
- [x] 创建 `src/core/DocxConverter.ts`
- [x] 实现 `extractText()` 方法
- [x] 实现 `extractHtml()` 方法
- [x] 实现 `convertBatch()` 方法

### Task 2.2: 集成到现有流程
- [x] 更新 CLI handler 支持 .docx 输入
- [x] 更新配置 schema 支持 .docx 扩展名

---

## Phase 3: PDF 提取

### Task 3.1: 实现 PdfExtractor
- [x] 创建 `src/core/PdfExtractor.ts`
- [x] 实现 `extractText()` 方法
- [x] 实现基本的文本清洗

### Task 3.2: 添加 extract 命令
- [x] 在 CLI handler 中添加 `extract` 命令
- [x] 支持单文件和批量处理

---

## Phase 4: 统一 CLI 体验

### Task 4.1: 更新 convert 命令
- [x] 添加 `--format` 选项 (pdf|txt|md|json)
- [x] 自动检测输入文件类型
- [x] 根据输出路径扩展名自动推断格式

### Task 4.2: 更新配置系统
- [x] 扩展 schema 支持 `output.format`
- [x] 更新配置加载器
- [x] 更新设置向导

---

## Phase 5: 测试和文档

### Task 5.1: 单元测试
- [x] DocxConverter 测试
- [x] PdfExtractor 测试
- [x] 输出格式化器测试

### Task 5.2: 更新文档
- [x] 更新 README.md (已更新 CLAUDE.md)
- [x] 更新 CLAUDE.md
