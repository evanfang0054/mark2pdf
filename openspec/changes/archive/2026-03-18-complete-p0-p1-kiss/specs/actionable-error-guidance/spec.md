## ADDED Requirements

### Requirement: Actionable error output protocol
系统 MUST 在 CLI 层输出统一错误信息结构，至少包含错误类别、问题摘要与建议动作。

#### Scenario: Error includes actionable next steps
- **WHEN** 执行过程中出现路径、权限或参数类错误
- **THEN** 用户在错误输出中可获得至少一个可执行修复建议

### Requirement: Consistent failure presentation across commands
系统 SHALL 在 `convert`、`html`、`merge`、`extract` 等命令下保持一致的错误输出风格与关键字段。

#### Scenario: Cross-command errors follow same format
- **WHEN** 用户在不同命令中触发同类错误
- **THEN** 输出结构和语义保持一致
