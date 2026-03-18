## ADDED Requirements

### Requirement: Unified convert entry for supported inputs
系统 SHALL 通过 `convert` 提供统一入口，并对支持的输入类型执行一致的最小调度行为。

#### Scenario: Convert accepts multiple supported input types
- **WHEN** 用户通过 `convert` 提供受支持类型的输入
- **THEN** 系统在同一命令语义下完成类型识别与处理分发

### Requirement: Clear parameter semantics
系统 MUST 对“输出格式”与“页面规格”等参数语义进行明确区分，避免混淆。

#### Scenario: User can distinguish parameter intent
- **WHEN** 用户查看 CLI 帮助并执行命令
- **THEN** 用户可明确识别不同参数的语义边界且不会因同名歧义误用

### Requirement: Backward-compatible parameter mapping with deprecation notice
系统 SHALL 在 P0 阶段保持旧参数可用，并提供明确弃用提示与迁移方向。

#### Scenario: Legacy parameter still works with warning
- **WHEN** 用户使用历史参数运行命令
- **THEN** 命令继续成功执行且输出弃用提示与建议替代参数

### Requirement: Documentation and help consistency
系统 MUST 保证 CLI help 与 README 示例在发布时与实际行为一致。

#### Scenario: Docs and help match command behavior
- **WHEN** 用户按文档示例执行命令
- **THEN** 命令行为与帮助文本/示例描述一致
