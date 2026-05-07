# CUSTOMER_DATA_SOURCE_MAP_V1

## P0 允许的数据源

仅允许通过以下 customer report API 进入页面与导出：

- `fetchCustomerDashboardAggregate()` → `/api/v1/reports/customer-dashboard/aggregate`
- `fetchFieldReport(fieldId)` → `/api/v1/reports/field/:fieldId`
- `fetchOperationReport(operationId)` → `/api/v1/reports/operation/:operationId`

## 明确禁止（客户页直连）

- `/api/v1/facts`
- `/api/admin`
- `/healthz`
- `/openapi`
- `legacy/control`
- raw telemetry
- debug API
- devtools

## 同源约束

- `CustomerDashboardPage` 仅使用 `fetchCustomerDashboardAggregate()`。
- `FieldReportPage` 仅使用 `fetchFieldReport(fieldId)`。
- `OperationReportPage` 仅使用 `fetchOperationReport(operationId)`。
- 所有 export 页面必须复用同一 ViewModel，不允许新增独立 API 拼接逻辑。
