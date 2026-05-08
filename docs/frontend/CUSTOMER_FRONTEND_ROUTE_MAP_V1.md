# CUSTOMER_FRONTEND_ROUTE_MAP_V1

状态：P1-A0 route governance baseline.
目的：明确当前客户路由、P1 目标路由、临时 index 路由迁移策略、export 路由和禁止客户路由。

## 1. 当前客户路由

| 当前路由 | 页面组件 | 当前状态 | 是否允许客户访问 | 备注 |
|---|---|---|---|---|
| `/customer/dashboard` | `CustomerDashboardPage` | 已存在 | 是 | 客户总览入口 |
| `/customer/export` | `CustomerDashboardExportPage` | 已存在 | 是 | 总览导出 |
| `/customer/fields/index` | `CustomerFieldsIndexPage` 或等价页面 | 临时 index 路由 | 暂时允许 | P1-A 必须迁移到 `/customer/fields` |
| `/customer/operations/index` | `CustomerWorkIndexPage` 或等价页面 | 临时 index 路由 | 暂时允许 | P1-A 必须迁移到 `/customer/operations` |
| `/customer/fields/:fieldId` | `FieldReportPage` | 已存在 | 是 | 地块病历，必须 field_name 优先 |
| `/customer/fields/:fieldId/export` | `FieldReportExportPage` | 已存在 | 是 | 地块报告导出 |
| `/customer/operations/:operationId` | `OperationReportPage` | 已存在 | 是 | 作业闭环报告，证据三态 |
| `/customer/operations/:operationId/export` | `CustomerReportExportPage` | 已存在 | 是 | 作业报告导出 |

## 2. P1 目标路由

| 目标路由 | 阶段 | 目标页面 | 迁移要求 |
|---|---|---|---|
| `/customer/dashboard` | P1-A0 | 客户总览 | 保留 |
| `/customer/fields` | P1-A | 地块列表 | 替代 `/customer/fields/index` |
| `/customer/operations` | P1-A | 作业列表 | 替代 `/customer/operations/index` |
| `/customer/reports` | P1-A | 报告中心 | 新增统一报告入口 |
| `/customer/fields/:fieldId` | P1-A0/P1-A | 地块病历 | 保留 |
| `/customer/operations/:operationId` | P1-A0/P1-A | 作业报告 | 保留 |

## 3. 临时 index 路由迁移策略

临时路由：

```text
/customer/fields/index
/customer/operations/index
```

迁移策略：

1. P1-A0 允许临时存在，但不得在新文档中作为正式客户 URL 表达。
2. P1-A-01 新增正式 `/customer/fields` 后，`/customer/fields/index` 应作为兼容 redirect 或薄入口。
3. P1-A-02 新增正式 `/customer/operations` 后，`/customer/operations/index` 应作为兼容 redirect 或薄入口。
4. P1-A 完成后，CustomerShell 不得再指向 `/index` 路由。

## 4. Export 路由

| Export 路由 | 对应页面 | 数据源 | 同源要求 |
|---|---|---|---|
| `/customer/export` | `CustomerDashboardExportPage` | `fetchCustomerDashboardAggregate` | 必须复用 dashboard VM |
| `/customer/fields/:fieldId/export` | `FieldReportExportPage` | `fetchFieldReport` | 必须复用 field VM |
| `/customer/operations/:operationId/export` | `CustomerReportExportPage` | `fetchOperationReport` | 必须复用 operation VM |

Export 路由禁止重新计算状态、风险、ROI、田块记忆和证据摘要。

## 5. 禁止客户路由

客户路由树禁止暴露：

```text
/admin/*
/debug/*
/devtools/*
/healthz
/openapi
/api/admin/*
/api/debug/*
/api/v1/facts/*
/api/v1/raw-telemetry/*
/api/v1/devices/*/credentials
/api/v1/skill-registry/write
/legacy/*
/operator/*  （P1-B 以前禁止进入客户导航）
```

## 6. CustomerShell 导航规则

CustomerShell 只允许客户主导航：

```text
总览
地块
作业
报告
```

禁止把以下入口放入客户主导航：

```text
operator
admin
debug
legacy
healthz
OpenAPI
skill registry
raw facts
raw telemetry
device credentials
```

## 7. 验收标准

- 当前客户路由和 P1 目标路由在本文中均有明确状态。
- 临时 index 路由只标记为迁移对象，不标记为最终正式路由。
- Export 路由明确同源要求。
- 禁止客户路由明确列出。
- 不把 `/api/v1/customer/recommendations/generate` 或类似推荐 API 写成当前已有客户路由能力。
