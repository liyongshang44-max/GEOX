# CUSTOMER_FRONTEND_ROUTE_MAP_V1

## P0 路由（本期范围）

- `/customer/dashboard`
- `/customer/export`
- `/customer/fields/:fieldId`
- `/customer/fields/:fieldId/export`
- `/customer/operations/:operationId`
- `/customer/operations/:operationId/export`

## 非 P0 路由（禁止纳入）

- `/customer/fields`
- `/customer/operations`
- `/customer/reports`
- `/operator/*`

## 回退规则

- `/` 必须重定向到 `/customer/dashboard`。
- 未知 `/customer/*` 必须回退到 `/customer/dashboard`。
