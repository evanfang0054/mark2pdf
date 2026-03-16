# Proposal: 添加多格式输入输出支持

## 概述

扩展 mark2pdf 的能力，支持更多输入格式（Word、PDF）和输出格式（纯文本、Markdown、JSON），满足普通用户批量转换文档的核心需求。

## 背景

当前项目能力：
- 输入：Markdown、HTML
- 输出：PDF（Markdown/HTML)、合并后的 PDF

用户痛点：
1. 普通用户缺少好用的 CLI 工具从 PDF 提取文本
2. Word 文档需要转换为其他格式
3. 转换后的内容需要给 AI 使用，需要干净的纯文本或结构化格式

## 目标

1. 支持 Word (.docx) 文件作为输入
2. 支持 PDF 文件作为输入（提取文本内容）
3. 新增输出格式选项：纯文本、Markdown、JSON
4. 统一 CLI 命令体验

## 范围

### 包含
- Word (.docx) 输入支持
- PDF 文本提取
- 统一的 `--format` 输出选项
- 批量处理支持
- 基本的文本清洗（去除多余空白）

### 不包含
- OCR 功能（扫描版 PDF）
- 复杂排版保留
- Watch 模式
- GUI 界面
- 在线服务/API

## 成功指标

1. `mark2pdf convert ./doc.docx -o ./output.pdf` 正常工作
2. `mark2pdf extract ./input.pdf -o ./output.txt` 提取文本
3. `mark2pdf convert ./docs --format txt` 批量输出纯文本

## 风险

- PDF 文本提取质量依赖原始 PDF 结构
- Word 复杂格式可能丢失

## 时间估算

- 设计: 1-2 小时
- 实现: 4-6 小时
- 测试: 2-3 小时
