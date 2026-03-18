## ADDED Requirements

### Requirement: Machine-readable execution report
系统 SHALL 支持输出结构化执行报告（JSON），至少包含总文件数、成功数、失败数、耗时与失败明细。

#### Scenario: Batch run produces structured report
- **WHEN** 用户启用结构化报告输出并执行批处理
- **THEN** 系统生成可被程序消费的 JSON 报告文件

### Requirement: Report-data and console-summary consistency
系统 MUST 保证结构化报告中的统计结果与终端摘要保持一致。

#### Scenario: Console and JSON show same totals
- **WHEN** 同一次执行同时输出终端摘要与 JSON 报告
- **THEN** 两者的总数、成功数、失败数与耗时一致
