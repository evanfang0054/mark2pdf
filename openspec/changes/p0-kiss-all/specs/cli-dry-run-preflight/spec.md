## ADDED Requirements

### Requirement: Dry-run preflight overview
系统 MUST 在启用 `--dry-run` 时仅执行预检，并输出可读的执行计划摘要。

#### Scenario: Dry-run summary is shown
- **WHEN** 用户以 `--dry-run` 执行转换命令
- **THEN** 系统仅输出预检信息且不执行任何实际转换

### Requirement: Dry-run file-level preview
系统 SHALL 在 dry-run 输出中列出将被处理的文件、目标输出路径与跳过原因（如不支持格式、路径无效、已满足跳过策略）。

#### Scenario: Preview includes processing decisions
- **WHEN** 输入包含可处理与不可处理文件
- **THEN** 输出中同时展示“待处理项”与“跳过项及原因”

### Requirement: Dry-run parity with real execution plan
系统 MUST 保证 dry-run 的文件选择与路径推导规则与实际执行一致，除转换动作外行为保持等价。

#### Scenario: Dry-run and actual run choose same files
- **WHEN** 用户先执行 dry-run 再执行同参数真实命令
- **THEN** 两次命令的待处理文件集合与输出路径规划一致
