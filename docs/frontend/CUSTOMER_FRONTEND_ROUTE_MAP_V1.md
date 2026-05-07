# CUSTOMER_FRONTEND_ROUTE_MAP_V1

> 目的：明确 Customer 前端 P0 可用路由边界，避免把 P1/P2 页面当成 P0 交付。

| Route | Page Component | P0/P1 | 是否可直接访问 | 是否在 CustomerShell 可点击 | Fallback 行为 | 备注 |
|---|---|---|---|---|---|---|
| `/customer/dashboard` | `CustomerDashboardPage` | P0 | 是 | 是 | - | 客户主入口。 |
| `/customer/export` | `CustomerExportPage` | P0 | 是 | 是 | - | 客户导出入口。 |
| `/customer/fields/:fieldId` | `FieldReportPage` | P0 | 是（需有效 `fieldId`） | 否（通过详情上下文进入） | `fieldId` 无效时回退 `/customer/dashboard` | 详情页，不做列表入口。 |
| `/customer/fields/:fieldId/export` | `FieldExportPage` | P0 | 是（需有效 `fieldId`） | 否（从 `FieldReportPage` 导出进入） | `fieldId` 无效时回退 `/customer/dashboard` | 详情导出。 |
| `/customer/operations/:operationId` | `OperationReportPage` | P0 | 是（需有效 `operationId`） | 否（通过详情上下文进入） | `operationId` 无效时回退 `/customer/dashboard` | 详情页，不做列表入口。 |
| `/customer/operations/:operationId/export` | `OperationExportPage` | P0 | 是（需有效 `operationId`） | 否（从 `OperationReportPage` 导出进入） | `operationId` 无效时回退 `/customer/dashboard` | 详情导出。 |
| `/customer/fields` | - | P1（不做） | 否 | 否 | 统一回退 `/customer/dashboard` | **P0 不存在该路由，不得在侧边栏/VM href 引用。** |
| `/customer/operations` | - | P1（不做） | 否 | 否 | 统一回退 `/customer/dashboard` | **P0 不存在该路由，不得在侧边栏/VM href 引用。** |
| `/customer/reports` | - | P1（不做） | 否 | 否 | 统一回退 `/customer/dashboard` | P1 统一报告入口。 |
| `/operator/*` | Operator 端页面 | P1/P2（不做） | 否 | 否 | 不在 customer 路由树，禁止跳转 | 与 customer 端隔离。 |

## 全局回退规则

- 未知 `/customer/*` → `/customer/dashboard`。
- `/customer/fields` 和 `/customer/operations` 在 P0 不存在，**不得**被侧边栏或任意 ViewModel `href` 引用。
