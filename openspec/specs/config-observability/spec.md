## ADDED Requirements

### Requirement: Effective configuration visibility
系统 SHALL 提供最终生效配置的可见输出，并标注关键字段来源（default/user/file/env/cli）。

#### Scenario: User can inspect effective config and source
- **WHEN** 用户启用配置观测输出（如命令参数或 verbose 模式）
- **THEN** 系统展示关键配置项最终值及其来源层级

### Requirement: Deterministic config precedence disclosure
系统 MUST 明确并稳定执行配置优先级，且观测输出 SHALL 与真实执行使用的配置一致。

#### Scenario: Displayed config matches runtime config
- **WHEN** 用户先查看生效配置再执行转换
- **THEN** 执行过程使用的配置与展示内容一致
