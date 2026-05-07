# CUSTOMER_DATA_SOURCE_MAP_V1

> 目的：锁定 P0 页面的数据来源边界，防止 P1/P2 或调试接口混入 customer 页面。

| Page | ViewModel | Allowed API | Forbidden API | Export 同源要求 | 备注 |
|---|---|---|---|---|---|
| `CustomerDashboardPage` | `buildCustomerDashboardVm` | `fetchCustomerDashboardAggregate` (`/api/v1/reports/customer-dashboard/aggregate`) | `/api/v1/facts`, `/api/admin`, `/healthz`, `/openapi`, legacy/control, raw telemetry, debug API, devtools | Dashboard 导出链路必须复用同源聚合数据，不得拼接新接口 | P0 页面。 |
| `FieldReportPage` | `buildFieldReportVm` | `fetchFieldReport` (`/api/v1/reports/field/:fieldId`) | 同上全部禁止项 | `FieldExportPage` 必须与 `FieldReportPage` 同源（同 `fieldId`、同数据源） | P0 详情页。 |
| `OperationReportPage` | `buildOperationReportVm` | `fetchOperationReport` (`/api/v1/reports/operation/:operationId`) | 同上全部禁止项 | `OperationExportPage` 必须与 `OperationReportPage` 同源（同 `operationId`、同数据源） | P0 详情页。 |

## 禁止 API（客户页直连）

- `/api/v1/facts`
- `/api/admin`
- `/healthz`
- `/openapi`
- `legacy/control`
- raw telemetry
- debug API
- devtools
