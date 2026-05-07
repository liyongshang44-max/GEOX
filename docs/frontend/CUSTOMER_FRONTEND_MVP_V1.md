# CUSTOMER_FRONTEND_MVP_V1

> 状态：CURRENT / P0 交付基线  
> 适用范围：GEOX Customer 前端产品化收口  
> 目标读者：前端开发、测试、交付、销售演示负责人  
> 最近核对：以 `main` 当前 Customer P0 路由、ViewModel、export 同源与 boundary gate 为准

## 1. 文档目的

本文定义 GEOX Customer 前端 P0 的最终可交付范围。

P0 的目标不是完成完整客户 SaaS，也不是完成 operator 工作台，而是把现有 customer 前端收口成一个可用于试点销售演示、客户交付说明和内部验收的最小正式产品面。

P0 客户前端必须做到：

- 客户能看懂当前地块风险、待处理事项、近期作业、设备异常和价值记录。
- 客户能从总览进入地块报告和作业报告。
- 客户能导出总览、地块、作业报告。
- 页面和导出同源，不出现页面一套结论、导出另一套结论。
- 不展示 raw/debug/admin/healthz/OpenAPI/legacy/control 等内部能力。
- 不伪造未接入的数据能力，例如真实天气、卫星地图、Field Memory、证据包摘要、ROI 明细。

## 2. P0 产品定位

P0 Customer 前端定位为：

**远程土地经营驾驶舱 + 地块病历 + 作业闭环证明 + 同源导出报告。**

它不是：

- 普通后台管理系统。
- Operator 调度中心。
- 设备管理平台。
- 农业 BI 大屏。
- 完整地图系统。
- 完整天气系统。
- 完整 Field Memory / ROI / Evidence Pack 下钻系统。

P0 要表达的是 GEOX 的主产品叙事：

```text
发现风险 → 给出建议 → 形成作业闭环 → 收集证据 → 生成验收与价值报告
```

## 3. P0 页面范围

P0 只承认以下 customer 页面族。

| 路由 | 页面组件 | P0 定位 | 是否可直接访问 | 备注 |
|---|---|---|---|---|
| `/customer/dashboard` | `CustomerDashboardPage` | 客户经营驾驶舱 / cockpit-lite | 是 | 客户主入口 |
| `/customer/export` | `CustomerDashboardExportPage` | 总览导出 | 是 | 与 Dashboard 同源 |
| `/customer/fields/:fieldId` | `FieldReportPage` | 地块病历 | 是，需有效 `fieldId` | 不做地块列表 |
| `/customer/fields/:fieldId/export` | `FieldReportExportPage` | 地块报告导出 | 是，需有效 `fieldId` | 与 FieldReport 同源 |
| `/customer/operations/:operationId` | `OperationReportPage` | 作业八段闭环证明 | 是，需有效 `operationId` | 不做作业列表 |
| `/customer/operations/:operationId/export` | `CustomerReportExportPage` | 作业报告导出 | 是，需有效 `operationId` | 与 OperationReport 同源 |

P0 不包含：

```text
/customer/fields
/customer/operations
/customer/reports
/operator/*
```

未知 `/customer/*` 必须回退到 `/customer/dashboard`。

## 4. P0 导航与 CustomerShell

CustomerShell 必须表达 4 类客户概念：

```text
总览
地块
作业
报告
```

P0 可点击入口仅限：

```text
/customer/dashboard
/customer/export
```

“地块”和“作业”可以作为当前详情页归属或 disabled 导航项，不得跳转到不存在的 `/customer/fields` 或 `/customer/operations`。

CustomerShell 必须避免暴露：

```text
admin
legacy
debug
healthz
OpenAPI
skill registry
devtools
raw facts
raw telemetry
migration
```

顶部上下文允许使用保守文案：

```text
当前角色：客户视图
当前范围：授权地块
```

禁止伪造租户名、项目名、地块数量、在线率。

## 5. P0 数据源白名单

Customer 页面只允许通过 customer report API adapter 进入数据：

| 页面 | ViewModel | API adapter | 后端接口 |
|---|---|---|---|
| `CustomerDashboardPage` | `buildCustomerDashboardVm` | `fetchCustomerDashboardAggregate` | `/api/v1/reports/customer-dashboard/aggregate` |
| `FieldReportPage` | `buildFieldReportVm` | `fetchFieldReport` | `/api/v1/reports/field/:fieldId` |
| `OperationReportPage` | `buildOperationReportVm` | `fetchOperationReport` | `/api/v1/reports/operation/:operationId` |

禁止 customer 页面直接调用：

```text
/api/v1/facts
/api/admin
/healthz
/openapi
legacy/control
raw telemetry
debug API
devtools
```

## 6. CustomerDashboardPage P0 要求

Dashboard 是 cockpit-lite，不是真实地图大屏。

必须包含：

- 客户经营总览标题。
- 3–5 个可信 KPI。
- 地块风险分布面板。
- 今日建议与待处理事项。
- 设备状态摘要。
- 价值结果摘要。
- 近期作业摘要。
- 总览导出入口。

P0 允许 KPI：

```text
待处理事项
风险地块
待验收作业
离线设备
价值记录
近期作业
```

禁止 KPI：

```text
在线地块 / 总地块
18 / 24 在线地块
今日待决策
执行中作业
待审批处方
```

除非后续 P1 引入正式 cockpit aggregate 并冻结计算口径。

Dashboard 地图位必须实现为：

```text
CockpitFieldRiskPanel
```

允许展示风险地块列表、简化 SVG 状态矩阵和无数据空态。禁止展示假卫星图、假真实地块边界、假热力图、假实时轨迹、假天气图层。

## 7. FieldReportPage P0 要求

FieldReportPage 是“地块病历”P0。

必须包含：

- 地块名称优先，field_id 次要。
- 当前风险。
- 诊断结论。
- 当前建议。
- 近期作业 Top 5。
- 设备与监测摘要。
- ROI 摘要或空态。
- Field Memory 摘要或空态。
- 地块报告导出入口。

Field Memory 规则：

- 只有 report payload 中存在显式 `field_memory_summary` / `field_memory` 等可识别字段时，才允许展示 Field Memory 摘要。
- 没有显式 Field Memory 时，必须显示“暂无可展示的地块记忆”。
- 不得用 operation count、device count、ROI count 推导 Field Memory。
- 不得伪造“系统已学习”“历史响应良好”“技能表现稳定”。

ROI 规则：

- 有 report value summary 时展示。
- 没有 ROI 时显示“暂无可量化价值记录”。
- 不得伪造节水、节人工、验收通过率。

天气规则：

- P0 不展示天气卡。
- open alerts 只能表达为“外部扰动”或“待处理事项”，不得表达为天气判断。

地图规则：

- 没有 geometry 时不得展示真实地图。
- P0 不展示卫星图和真实 GIS 图层。

## 8. OperationReportPage P0 要求

OperationReportPage 是“作业闭环证明页”。

必须固定展示 8 段：

```text
建议
处方合同
审批
执行 / as-executed
证据
验收
ROI
田块记忆
```

每段必须有：

```text
status
title
summary
items
emptyState（缺失时）
```

缺失数据不能隐藏整段，必须显示客户可理解的空态。

客户主视图禁止出现：

```text
DONE
MISSING
PENDING
AVAILABLE
NOT_APPLICABLE
Skill trace
skill_run_id
raw JSON
operation_plan_id
receipt_id
recommendation_id
```

如需排障，这些内容只能进入“技术详情”折叠区，默认关闭。

## 9. Export P0 要求

Export 页面必须与页面同源。

| Export 页面 | 必须复用 VM |
|---|---|
| `CustomerDashboardExportPage` | `buildCustomerDashboardVm` |
| `FieldReportExportPage` | `buildFieldReportVm` |
| `CustomerReportExportPage` | `buildOperationReportVm` |

Export 页面禁止：

- 自定义 `STATUS_MAP`。
- 自定义 `RISK_MAP`。
- 自定义 `ACCEPTANCE_MAP`。
- 重新计算风险。
- 重新计算 ROI。
- 重新拼 Field Memory。
- 直接请求 raw/debug/admin API。

兼容文件 `OperationReportExportPage.tsx` 如存在，必须是：

```ts
export { default } from "./CustomerReportExportPage";
```

## 10. 组件与 ViewModel 边界

P0 原则：

```text
ViewModel 负责业务判断。
组件只负责渲染。
页面只负责取数、加载态、错误态和布局。
```

Customer 组件目录：

```text
apps/web/src/components/customer/
```

Cockpit 组件目录：

```text
apps/web/src/components/cockpit/
```

组件禁止直接请求 API、直接 import admin/debug/devtools、自行判断业务状态、硬编码 fake sample 数据、根据 raw enum 直接显示客户文案。

## 11. Boundary / Gate

P0 必须通过以下 gate：

```bash
pnpm --filter @geox/web run typecheck
pnpm --filter @geox/web run build
pnpm --filter @geox/web run lint
pnpm --filter @geox/web run check:customer-boundary
pnpm --filter @geox/web run lint:operation-status-convergence
pnpm --filter @geox/web run check:customer-export-same-source
```

`check:customer-boundary` 必须覆盖 Customer 页面、FieldReportPage、OperationReportPage、Export 页面、viewmodels、components/customer、components/cockpit。

`lint:operation-status-convergence` 必须防止：

```text
receipt exists → SUCCESS / PASS
task completed → PASS
no error → SUCCESS
```

`check:customer-export-same-source` 必须防止 Export 页面不复用 VM、Export 页面自定义状态映射、OperationReportExportPage 不是 CustomerReportExportPage re-export。

## 12. P1/P2 明确不属于 P0

P1：

```text
/customer/fields
/customer/operations
/customer/reports
/api/v1/customer/cockpit/overview
/api/v1/operations/:id/evidence-pack-summary
独立 Field Memory 查询与详情
ROI 明细 Drawer / Page
真实地块地图
```

P2：

```text
/operator/*
天气源
卫星底图
As-applied 地图覆盖
变量处方图层
完整设备管理中心
完整告警规则管理
Skill registry 客户可视化
```

P0 不允许为了视觉效果提前伪造这些能力。

## 13. 完成定义

P0 完成后，必须满足：

- `/customer/dashboard` 可作为客户演示入口。
- `/customer/fields/:fieldId` 可解释单地块状态。
- `/customer/operations/:operationId` 可解释单作业闭环。
- 三类 export 与页面同源。
- 客户页不暴露内部工程信息。
- 没有假天气、假地图、假 Field Memory、假 ROI。
- P1/P2 缺口在 Gap Baseline 中明确记录。
- 所有 web gate 通过。

通过后可进入客户视觉验收、销售演示脚本验收、试点交付样例链验收。
