# Route Dependency Contract（服务端路由依赖分层约定）

> 目的：统一新页面/新流程在服务端 API 依赖上的选型，避免继续扩大 telemetry 历史路由耦合，确保 operation 主数据面可演进。

## 1) Mainline APIs（新页面/新流程必须优先依赖）

### 核心原则
- 新增页面、新增业务流程、重构后的主链路，**必须**优先依赖 `operation` 主数据面。
- `operation` 主数据面必须来自：
  - `/api/v1/operations/*`
  - 对应 read model（含聚合后的 operation 视图/投影）

### Successor 原则（强制）
- operation 主数据面必须来自 `/api/v1/operations/*` 与对应 read model，**不得**围绕 telemetry 路由自行拼 detail。
- 任何“先拉 telemetry 再本地二次拼装 operation detail”的实现，视为违反主干依赖约定。

## 2) Compatibility APIs（可用但禁止新依赖）

> 仅用于存量功能稳定运行、灰度过渡与迁移窗口，**禁止**新增调用点。

- `/api/telemetry/v1/query`
- `/api/v1/telemetry/latest`

约束：
- 不得在新模块中新增 direct call。
- 不得在新接口中把 compatibility 路由作为主数据来源。
- 允许在迁移 PR 中“减少调用量/收敛调用入口”，不允许“扩散调用范围”。

## 3) Legacy / Deprecated APIs（仅迁移与历史兼容）

> 仅允许用于历史兼容与受控迁移，默认视为淘汰路径。

- `/api/v1/telemetry/series`
- `/api/v1/telemetry/metrics`

约束：
- 禁止新功能接入。
- 禁止新增跨模块透传。
- 仅允许在“迁移关闭单”内短期保留，并需标注下线计划。

## 4) Review 拒绝规则（出现新调用时的判定标准）

出现以下任一情形，Code Review 应直接拒绝：

1. 新页面/新流程新增对 Compatibility 或 Legacy/Deprecated 路由的调用。
2. 在 operation 详情场景中，通过 telemetry 路由进行字段拼装（包括 service 层拼装、BFF 拼装、前端聚合拼装）。
3. 将 telemetry 路由作为 operation 主数据面的事实来源，而非 `/api/v1/operations/*` + read model。
4. 以“复用旧实现”为由新增 telemetry 路由依赖，且未提供迁移计划与替代路径。
5. 迁移 PR 中出现 telemetry 调用净增（调用点、调用频次、调用覆盖范围任一维度上升）。

## 执行建议（非阻断）

- 在 PR 描述中新增“Route Dependency Checklist”：
  - 是否只依赖 Mainline APIs？
  - 如涉及 Compatibility/Deprecated，是否仅用于迁移且调用净减？
  - 是否给出 operation read model 替代方案与落地时间？
- 对 telemetry 存量调用建立统一 adapter，逐步收敛到单入口后再替换。
