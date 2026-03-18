## Why

当前项目在 P0 方向已明确，但尚未形成可直接进入实现的完整工件集；同时 P1（配置可观测、错误可操作、结果可追踪）尚未被系统化定义。现在需要以 KISS 原则把 P0 到 P1 串成同一条最小可交付路径，降低用户试错成本并提升 CLI 的可预测性。

## What Changes

- 完成并固化 P0：统一 CLI 参数语义、`convert` 最小统一入口、`--dry-run` 预检、帮助与文档一致化。
- 增补 P1 的最小高价值能力：配置生效可观测、错误提示可操作、批处理结果结构化报告。
- 保持向后兼容：旧参数可继续使用并给出弃用提示，不引入破坏性迁移。
- 以最小改动复用现有模块，不重写转换引擎与并发模型。

## Capabilities

### New Capabilities
- `cli-consistency-and-safety`: 统一 CLI 参数语义与命令入口行为，提供 dry-run 预检并确保无副作用。
- `config-observability`: 提供最终生效配置与来源可见性，降低多层配置叠加下的排障成本。
- `actionable-error-guidance`: 建立统一错误输出格式与可操作建议，提升失败场景可恢复性。
- `structured-execution-report`: 为批处理输出机器可读报告，支持后续 CI 与自动化消费。

### Modified Capabilities
- 无

## Impact

- 主要影响 `src/bin/mark2pdf.ts`、`src/cli/handler.ts`、`src/config/loader.ts`、`src/services/*`、`src/utils/*`。
- 涉及 CLI 参数解析与命令分发、配置加载可视化、错误输出策略、报告输出逻辑。
- 需要同步更新 README、CLI `--help`、以及对应单元/集成测试。
- 对用户脚本的影响以兼容层与弃用提示缓释，不做破坏性默认行为切换。
