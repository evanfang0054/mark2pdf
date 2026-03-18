## ADDED Requirements

### Requirement: Unified convert dispatch for supported input types
系统 SHALL 通过 `convert` 提供统一入口，并对 `.md`、`.html`、`.docx`、`.pdf` 等受支持输入执行一致的类型识别与分发流程。

#### Scenario: Convert routes supported mixed inputs
- **WHEN** 用户在 `convert` 下提供目录或文件，且包含多种受支持类型
- **THEN** 系统按统一规则识别类型并分发到对应处理器执行

### Requirement: Clear and non-ambiguous CLI parameter semantics
系统 MUST 对“页面规格”“输出文本格式”“输入路径/输出路径”等参数语义进行明确区分，避免同名或近义歧义。

#### Scenario: Help text clarifies parameter intent
- **WHEN** 用户查看 `mark2pdf convert --help`
- **THEN** 每个关键参数的语义边界清晰且无冲突描述

### Requirement: Backward compatibility with deprecation guidance
系统 SHALL 保留历史参数可用性，并在使用时输出弃用提示和替代参数建议。

#### Scenario: Legacy option still runs with migration hint
- **WHEN** 用户使用历史参数执行转换
- **THEN** 命令继续成功执行并输出明确迁移指引

### Requirement: Dry-run preflight without side effects
系统 MUST 在启用 `--dry-run` 时仅输出执行计划（待处理文件、输出路径、跳过原因），且不得创建文件或触发实际转换。

#### Scenario: Dry-run outputs plan only
- **WHEN** 用户执行 `convert --dry-run`
- **THEN** 系统输出计划摘要并且不产生任何输出文件
