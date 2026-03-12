# GEOX 仓库对照 Commercial v1 蓝图的缺口审查（2026-03-11）

> 结论先行：仓库已经具备 **Field/GIS、Device、Telemetry、Alerts、Evidence Export、AO-ACT 基础能力**，但离你给的“可销售商业版蓝图”仍有一批关键缺口，主要集中在 **账户体系、API 标准化一致性、作业计划域、交付形态与验收自动化**。

## 1. 当前已具备（可复用为 Commercial v1 基座）

- Web 信息架构主导航已覆盖：Dashboard / Fields / Devices / Operations / Alerts / Audit&Export / Settings。 
- 已有字段级接口：`/api/v1/fields`、字段详情、polygon、season。 
- 已有设备域能力：设备列表/详情、设备状态、心跳、接入向导。 
- 已有告警域：规则、事件、ack/close、通知渠道。 
- 已有证据导出异步作业：创建/列表/详情/下载。 
- 已有 AO-ACT 执行闭环核心路由：审批、任务、dispatch、receipt。 
- 已有最小角色模型（admin/operator）与 scope 门禁。

---

## 2. 与蓝图相比的“明确欠缺”

## A. 产品与交付边界层

1) **SaaS 多租户“用户体系”不足**（高优先级）  
当前 token 体系是静态文件驱动（SSOT JSON），仅支持 bearer + role/scopes；缺少真正的用户目录、登录会话、密码/IdP 对接、租户内用户管理 UI/API。  
影响：很难作为标准 SaaS 商业交付（特别是客户要求 SSO/账号审计时）。

2) **私有化“一键商用编排”未到位**（高优先级）  
默认 `docker-compose.yml` 仅包含 `postgres + server`；蓝图要求商业最小形态至少包含 `db + api + web + mqtt + worker + minio` 的一键启动与验收链路。  
影响：交付实施成本高，销售演示与客户 PoC 不够平滑。

3) **Mobile 最小版缺失**（中优先级）  
仓库仅有 `apps/web`，暂无移动端应用或同等替代策略（PWA/响应式专门工作面）。

## B. 领域模型与事实/投影层

4) **Field 领域还缺 `FieldSeason -> CropPlan` 里的 CropPlan 实体化**（中优先级）  
已有 season，但缺 crop plan 独立模型、事实类型与投影索引（例如 `crop_plan_*`）。

5) **OperationPlan 领域未独立落地**（高优先级）  
蓝图要求 `OperationPlan -> ApprovalRequest -> AoActTask -> ExecutionReceipt`，当前仓库主要从 approval/task 直接驱动，未看到 operation_plan 事实与 projection 独立存在。

6) **Telemetry 聚合投影不足**（中优先级）  
已存在 `telemetry_index_v1` 查询能力，但缺蓝图建议的日报/周报聚合表（如 `telemetry_aggregate_daily_v1`）以支持低成本报表与大规模查询。

## C. API 蓝图一致性层（接口命名与覆盖）

7) **Auth API 不完整**（高优先级）  
仅有 `GET /api/v1/auth/me`，缺 `POST /api/v1/auth/login` 与可选 `logout`。

8) **Fields API 缺 `PUT /api/v1/fields/:field_id`**（高优先级）  
蓝图要求配置更新走“写 fact + 更新 projection”的语义；当前未提供该标准入口。

9) **Devices API 与蓝图存在路径偏差**（中优先级）  
- 设备注册主入口为 `POST /api/v1/devices/:device_id`（而非蓝图建议的 `POST /api/v1/devices`）。
- credential/revoke 主要挂在 `/api/devices/...` 兼容路径，`/api/v1` 命名不完整。
- 绑定接口为 `POST /api/v1/devices/:device_id/bind-field`，与蓝图建议 `.../bindings` 不一致。

10) **Telemetry API 缺“field 维度自动聚合查询”**（中优先级）  
`/api/v1/telemetry/series` 当前以 `device_id` 为必需参数，不支持蓝图要求的 `field_id` 自动聚合绑定设备。

11) **Telemetry metrics 接口语义不匹配蓝图**（中优先级）  
`/api/v1/telemetry/metrics` 当前偏向“单设备指标摘要”，而非“系统支持 metrics 列表/单位目录”。

12) **Operations API 缺 `operations/plans` 主线**（高优先级）  
蓝图要求 `POST/GET /api/v1/operations/plans...`；当前未形成该资源模型。

13) **Approvals API 路径与蓝图不同**（低到中优先级）  
当前是 `/api/v1/approvals`、`/api/v1/approvals/:id/decide`；蓝图建议 `/api/v1/approvals/requests` 语义更清晰。

## D. UI 产品化层

14) **Fields/Devices 页已可用，但“商业运营视角组件”仍不完整**（中优先级）  
比如 Dashboard 的“快捷一键创建作业/导出证据包/告警快捷确认”虽然可绕行实现，但尚未形成标准化产品动作编排。

15) **Audit 页面与导出模板中心能力仍偏 MVP**（中优先级）  
蓝图强调多模板（PDF/CSV/JSON）+ hash + manifest 一体化外显工作流；后端已具备关键部分，但前台模板化运营体验有待补齐。

## E. 商业验收与运维可靠性层

16) **Commercial v1 验收脚本集不完整**（高优先级）  
目前可见 A 系列/局部脚本与历史验收资产，但缺你蓝图里“租户隔离、凭据门禁、幂等、导出复验、RBAC、A1/A2 回归”的一键化全集编排。

17) **运维可观测性交付件需要进一步产品化**（中优先级）  
缺统一可交付的 SLO/SLI 面板、告警规则包（DB/MQTT/队列积压）与运维 runbook 的完整打包闭环。

---

## 3. 建议按“可卖优先”分三阶段补齐

### 阶段 P0（2~3 周，先能签单）
- 补齐 Auth：`login/logout`（或明确对接外部 IdP 并提供兼容 API 壳）。
- 补齐 `PUT /api/v1/fields/:field_id`。
- 统一设备与审批 API 命名：提供 `/api/v1` 标准别名，不破坏旧路径。
- 提供 `docker-compose.commercial_v1.yml`：至少含 `postgres + server + web + mqtt + worker + minio`。
- 交付 Commercial v1 acceptance 脚本入口（单命令跑全套）。

### 阶段 P1（3~5 周，提升交付质量）
- 增加 `operations/plans` 资源模型与投影。
- 增加 field 维度 telemetry 聚合查询与指标目录接口。
- 完成 UI 的“向导化作业创建 + 证据导出模板中心 + 快捷操作”。

### 阶段 P2（中期演进）
- CropPlan 领域实体化。
- 移动端最小版本（或 PWA）.
- 观测/备份/恢复与安全审计文档打包到标准交付清单。

---

## 4. 审查方法（本次）

- 逐一核对：后端路由注册、主要 route 实现、Web 导航与页面、compose 编排、acceptance 目录与交付文档。 
- 判定口径：以你给出的 Commercial v1 蓝图为“目标合同”，按 **已具备 / 部分具备 / 欠缺** 分类，并聚焦“会影响签单与交付”的缺口。
