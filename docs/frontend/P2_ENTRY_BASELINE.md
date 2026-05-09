# P2_ENTRY_BASELINE

目的：定义进入 P2 开发前，P1 前端可交付基线与最小门槛。

## 1. 路由基线
### 客户侧
- `/customer/dashboard`
- `/customer/fields`
- `/customer/operations`
- `/customer/reports`
- `/customer/fields/:fieldId`
- `/customer/operations/:operationId`
- `/customer/export`
- `/customer/fields/:fieldId/export`
- `/customer/operations/:operationId/export`

### 运营侧
- `/operator/workbench`
- `/operator/approvals`
- `/operator/dispatch`
- `/operator/acceptance`
- `/operator/evidence`
- `/operator/devices-alerts`
- `/operator/roi-ledger`
- `/operator/field-memory`

## 2. Gate 基线命令
```bash
pnpm --filter @geox/web run typecheck
pnpm --filter @geox/web run build
pnpm --filter @geox/web run lint
pnpm --filter @geox/web run check:customer-boundary
pnpm --filter @geox/web run lint:operation-status-convergence
pnpm --filter @geox/web run check:customer-export-same-source
pnpm --filter @geox/web run check:customer-routes
pnpm --filter @geox/web run check:no-raw-enum-customer
pnpm --filter @geox/web run check:operator-boundary
```

## 3. 进入 P2 的前置条件
- 上述路由具备稳定可访问入口。
- Gate 命令在目标分支可复现通过。
- `P1_API_READINESS_MATRIX_V1.md`、`P1_COMPLETION_REPORT.md`、`P1_KNOWN_LIMITATIONS.md` 三份文档保持一致。

## 4. 非目标（进入 P2 前不做）
- 不新增 customer API。
- 不开放 operator 写操作。
- 不引入地图、天气、as-applied。
- 不重构 P1 页面结构。
