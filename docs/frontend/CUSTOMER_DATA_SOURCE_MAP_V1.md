# CUSTOMER_DATA_SOURCE_MAP_V1

状态：P1-A0 data source governance baseline.
目的：锁定客户页面 API、ViewModel、fallback、列表完整性和销售演示可用性，防止 raw/debug/admin 数据混入客户主界面。

## 1. 客户页面数据源总表

| 客户页面 | 当前路由 | API adapter | API 路径 | ViewModel | 是否 fallback | 是否完整列表 | 是否可用于销售演示 | 说明 |
|---|---|---|---|---|---|---|---|---|
| 客户总览 | `/customer/dashboard` | `fetchCustomerDashboardAggregate` | `/api/v1/reports/customer-dashboard/aggregate` | `buildCustomerDashboardVm` | 是，允许正式空态 | 否，聚合摘要 | 是 | 用于销售演示主入口，但不得伪造未接入数据 |
| 总览导出 | `/customer/export` | `fetchCustomerDashboardAggregate` | `/api/v1/reports/customer-dashboard/aggregate` | `buildCustomerDashboardVm` | 是，允许正式空态 | 否，聚合摘要 | 是 | 必须与 dashboard 页面同源 |
| 临时地块列表 | `/customer/fields/index` | 当前实现视仓库为准 | 当前实现视仓库为准 | 当前实现视仓库为准 | 是，允许正式空态 | 不保证 | 谨慎可用 | P1-A-01 必须迁移为 `/customer/fields` |
| 临时作业列表 | `/customer/operations/index` | 当前实现视仓库为准 | 当前实现视仓库为准 | 当前实现视仓库为准 | 是，允许正式空态 | 不保证 | 谨慎可用 | P1-A-02 必须迁移为 `/customer/operations` |
| 地块病历 | `/customer/fields/:fieldId` | `fetchFieldReport` | `/api/v1/reports/field/:fieldId` | `buildFieldReportVm` | 是，允许正式空态 | 否，单地块详情 | 是 | field_name 优先，field_id 不作为主标题 |
| 地块导出 | `/customer/fields/:fieldId/export` | `fetchFieldReport` | `/api/v1/reports/field/:fieldId` | `buildFieldReportVm` | 是，允许正式空态 | 否，单地块详情 | 是 | 必须与地块病历同源 |
| 作业报告 | `/customer/operations/:operationId` | `fetchOperationReport` | `/api/v1/reports/operation/:operationId` | `buildOperationReportVm` | 是，允许正式空态 | 否，单作业详情 | 是 | 证据段必须三态表达 |
| 作业导出 | `/customer/operations/:operationId/export` | `fetchOperationReport` | `/api/v1/reports/operation/:operationId` | `buildOperationReportVm` | 是，允许正式空态 | 否，单作业详情 | 是 | 必须与作业报告同源 |
| 报告中心 | `/customer/reports` | 待定 adapter | 需 P1-A-03 定义 | 待定 VM | 是，必须正式空态 | 目标为索引列表 | P1-A 后可用 | 当前不得标记为已完成 |

## 2. 当前允许 API

客户页面当前允许的已存在 API：

```text
/api/v1/reports/customer-dashboard/aggregate
/api/v1/reports/field/:fieldId
/api/v1/reports/operation/:operationId
```

说明：上述 API 通过 `apps/web/src/api/customerReports.ts` 间接暴露给客户页面。

## 3. 当前不应写成已存在的 API

以下 API 在 P1-A0 文档中不得写成“当前已有客户 API”：

```text
/api/v1/customer/fields
/api/v1/customer/operations
/api/v1/customer/reports
/api/v1/customer/recommendations/generate
/api/v1/operations/:operationId/evidence-summary
/api/v1/operations/:operationId/evidence-pack-summary
/api/v1/customer/roi-ledger
/api/v1/customer/field-memory
```

这些能力只能在 readiness matrix 中标记为 adapter 可包、需新增或未接入。

## 4. 禁止客户页面直连 API

客户页面禁止直接调用：

```text
/api/admin/*
/api/debug/*
/api/v1/facts/*
/api/v1/raw-telemetry/*
/api/v1/devices/*/credentials
/api/v1/skill-registry/write
/healthz
/api/admin/healthz
/api/v1/openapi.json
legacy control API
```

## 5. Fallback 规则

允许 fallback 的范围：

- 加载失败：显示客户可读错误态。
- 无数据：显示正式空态。
- 无 geometry：显示“暂无地块 geometry，当前以列表方式展示”。
- 无 ROI：显示“暂无可量化价值记录”。
- 无田块记忆：显示“暂无可展示的田块记忆”。
- 有证据但无证据包摘要：显示“已有证据记录，暂无证据包摘要”。

禁止 fallback 的范围：

- 不得伪造地图 geometry。
- 不得伪造天气。
- 不得伪造 evidence manifest。
- 不得伪造 sha256。
- 不得伪造下载按钮。
- 不得用作业数量推导田块记忆。
- 不得用 receipt 存在推导验收通过。

## 6. 销售演示判定

| 页面 | 可销售演示条件 |
|---|---|
| Dashboard | aggregate API 有数据或空态清楚，无工程字段 |
| FieldReport | field_name 可读；风险、诊断、近期作业、空态清楚 |
| OperationReport | 八段闭环清楚；证据三态；技术详情默认关闭 |
| Export | 与页面同源，文案一致，无 raw enum |
| 临时 index 页 | 仅可内部演示，正式销售前需迁移到目标路由 |
| Reports center | P1-A-03 完成前不可作为销售演示承诺 |

## 7. 验收标准

- 每个客户页面都有 API adapter 和 VM 来源记录。
- 每个页面明确 fallback 策略。
- 临时 index 页面明确“不保证完整列表”。
- 未接入 API 不写成当前已有。
- 销售演示可用性有明确标记。
