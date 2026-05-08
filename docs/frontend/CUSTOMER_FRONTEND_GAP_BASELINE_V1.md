# CUSTOMER_FRONTEND_GAP_BASELINE_V1

状态：P1-A0 gap baseline.
目的：记录客户前端从当前状态进入 P1-A/P1-B/P1-C 的缺口，避免把未接入能力误当已完成能力。

## 1. P1-A0 当前已收口项

| 项目 | 当前状态 | P1-A0 处理方式 | 后续动作 |
|---|---|---|---|
| CustomerShell 文案 | 已收口 | 去掉工程阶段、人名、假范围 | P1-A 接正式 session/context 后替换保守占位 |
| FieldReport 客户文案 | 已收口 | 地块病历、田块记忆、正式空态 | P1-A 继续补列表入口和 adapter |
| Operation Evidence 三态 | 已收口 | 页面区分无证据/有记录无摘要/有证据包摘要 | P1-A/P1-C 接正式 evidence summary 后可扩展 |
| 技术折叠 label | 已收口 | 默认关闭，客户化 label | 后续补脚本检查 raw key |
| docs/frontend | 本文档组补齐 | 建立 P1-A0 文档基线 | 后续变更必须同步更新 |

## 2. P1-A 缺口

| 缺口 | 当前状态 | P1-A 目标 | fallback 策略 | 禁止伪造项 |
|---|---|---|---|---|
| `/customer/fields` | 当前存在临时 `/customer/fields/index` | 正式地块列表路由 | 临时 index 保留 redirect 或兼容入口 | 不得伪造完整地块列表 |
| `/customer/operations` | 当前存在临时 `/customer/operations/index` | 正式作业列表路由 | 临时 index 保留 redirect 或兼容入口 | 不得伪造作业状态 |
| `/customer/reports` | 未完成 | 报告中心 | 无数据时显示正式空态 | 不得展示不存在的报告下载 |
| fields/operations/reports adapter | 部分依赖现有 report API | 建立客户列表 adapter | 无列表 API 时用明确空态 | 不得直接调用 admin/debug/raw API |
| 处方详情抽屉只读版 | 未完成 | 只读展示正式处方 | 无处方时空态 | 不得生成处方或伪造剂量 |
| 作业证据 fallback 增强 | 已有初步三态 | 接入更完整内嵌摘要 | 缺 summary 时三态降级 | 不得伪造 manifest/sha256 |
| ROI 明细只读入口 | 未完成 | 客户可读价值明细 | 无 ROI 时正式空态 | 不得伪造节水/节人工 |
| Field Memory 只读面板 | 未完成 | 田块记忆只读摘要 | 无记忆时正式空态 | 不得用作业数量推导记忆 |

## 3. P1-B 缺口

| 缺口 | 当前状态 | P1-B 目标 | 备注 |
|---|---|---|---|
| `/operator` shell | 未完成 | OperatorShell 与 operator 路由基座 | 与 customer 导航隔离 |
| `/operator/workbench` | 未完成 | 只读总队列 | 不直接暴露 debug/healthz |
| `/operator/approvals` | 未完成 | 审批中心 | 必须走 approval adapter |
| `/operator/dispatch` | 未完成 | 派发状态页 | 不暴露 device credential secret |
| `/operator/acceptance` | 未完成 | 验收中心 | 以 final_status/read model 为准 |
| `/operator/evidence` | 未完成 | 证据中心 | 不展示裸文件路径 |
| operator boundary check | 未完成 | operator 调用边界脚本 | 禁止 debug/healthz/raw facts |

## 4. P1-C 缺口

| 缺口 | 当前状态 | P1-C 目标 | 禁止伪造项 |
|---|---|---|---|
| 设备与告警中心 | 部分 API 可能存在 | OperatorDevicesAlerts | 不展示 credential secret payload |
| ROI Ledger 运营明细 | 未完成 | 运营明细页 | 不伪造 ROI |
| Field Memory 运营中心 | 未完成 | 田块记忆运营中心 | 不伪造学习结果 |
| SkillTraceFoldout 深化 | 未完成 | 可审计技能追踪折叠 | 客户主界面仍禁止 raw trace |
| Alert ACK / close | 未完成 | 告警操作接入 | 不绕过审批边界 |
| Device credential status | 未完成 | 只读状态展示 | 不展示密钥明文 |

## 5. API 缺口基线

| API / 能力 | 当前状态 | 后续处理 | 禁止说明 |
|---|---|---|---|
| `/api/v1/reports/customer-dashboard/aggregate` | 已存在 | 继续作为 Dashboard 数据源 | 不直接混用 raw facts |
| `/api/v1/reports/field/:fieldId` | 已存在 | 继续作为 FieldReport 数据源 | 不伪造 geometry |
| `/api/v1/reports/operation/:operationId` | 已存在 | 继续作为 OperationReport 数据源 | 不伪造 evidence summary |
| `/api/v1/customer/fields` | 需新增或 adapter 可包 | P1-A-04 定义 | 不标记当前已有 |
| `/api/v1/customer/operations` | 需新增或 adapter 可包 | P1-A-04 定义 | 不标记当前已有 |
| `/api/v1/customer/reports` | 需新增或 adapter 可包 | P1-A-03/P1-A-04 定义 | 不标记当前已有 |
| `/api/v1/operations/:operationId/evidence-pack-summary` | 未接入客户层 | P1-A/P1-C 决定 | 未接入前不得显示下载证据包 |
| `/api/v1/customer/roi-ledger` | 未接入 | P1-A-07/P1-C-02 | 不伪造 ROI 明细 |
| `/api/v1/customer/field-memory` | 未接入 | P1-A-08/P1-C-03 | 不伪造田块记忆 |
| 推荐生成 API | 未纳入客户前端当前能力 | 农艺链路另行治理 | 不写成当前已有客户 API |

## 6. Boundary Exemptions

豁免必须使用：

```text
// customer-boundary-allow: <reason>
```

缺少 reason 的豁免视为无效。

技术折叠区允许保留审计追溯字段，但必须满足：

- 默认关闭。
- label 客户化。
- 不进入客户主叙事。
- 不显示 raw JSON。
- 不显示 stack trace 原文，若展示必须标为“错误堆栈（技术排障）”。

## 7. 验收标准

- 本文明确 P1-A0/P1-A/P1-B/P1-C 缺口。
- 未接入 API 不被标记为当前已有。
- 缺口均有 fallback 或禁止伪造策略。
- P1-A0 无文档缺口。
