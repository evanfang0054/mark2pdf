# mark2pdf

一个功能强大的 Markdown 转 PDF 工具，支持批量转换和 PDF 合并功能。基于 Node.js 构建，提供高度可配置的文档转换解决方案。

## ✨ 主要特性

- 🚀 批量转换 Markdown 文件为 PDF
- 📦 支持 PDF 文件合并
- 🎯 灵活的配置选项
- 📁 保持原始目录结构
- 🔄 并发处理提升效率
- 🎨 自定义 PDF 样式和布局
- 📊 详细的转换日志
- 🔍 智能文件过滤
- 🛡️ 健壮的错误处理机制
- 🧠 内存使用监控

## 🚀 快速开始

### 环境要求

- Node.js >= 14.0.0
- pnpm (推荐) 或 npm

### 安装

```bash
# 克隆项目
git clone https://github.com/evanfang0054/mark2pdf.git
cd mark2pdf

# 安装依赖
pnpm install
```

### 基本使用

```bash
# 转换 Markdown 为 PDF
pnpm run start

# 合并 PDF 文件
pnpm run merge
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
- **转换引擎**：负责 Markdown 到 PDF 的转换
- **合并引擎**：处理多个 PDF 文件的合并
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

- **核心依赖**
  - `markdown-pdf`: Markdown 转 PDF 引擎
  - `pdf-lib`: PDF 操作和合并
  - `commander`: 命令行参数解析
  - `chalk` & `ora`: 终端输出美化

- **开发工具**
  - Node.js
  - pnpm
  - ESLint
  - Jest (单元测试)

## 🔧 开发指南

### 项目结构

``` bash
├── assets/            # 静态资源
│   └── pdf-style.css  # PDF 样式文件
├── config.json        # 转换配置
├── merge.config.json  # 合并配置
├── public/            # 公共资源
│   └── md/            # Markdown 文件目录
├── src/               # 源代码
│   ├── config/        # 配置管理
│   ├── core/          # 核心功能
│   ├── scripts/       # 脚本入口
│   ├── services/      # 服务层
│   └── utils/         # 工具函数
└── dist/              # 输出目录
    ├── pdf/           # 转换后的 PDF
    └── mergePdf/      # 合并后的 PDF
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

### 调试技巧

- 使用 `logger.setLevel('debug')` 启用详细日志
- 监控内存使用情况以优化大文件处理
- 使用 Node.js 调试工具分析性能瓶颈
