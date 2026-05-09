# P1_COMPLETION_REPORT

状态：P2-A0 Gate 报告（P1 Release 基线）。

## 1. 路由覆盖清单（客户侧）
- `/customer/dashboard`
- `/customer/fields`
- `/customer/operations`
- `/customer/reports`
- `/customer/fields/:fieldId`
- `/customer/operations/:operationId`
- `/customer/export`
- `/customer/fields/:fieldId/export`
- `/customer/operations/:operationId/export`

## 2. 路由覆盖清单（运营侧）
- `/operator/workbench`
- `/operator/approvals`
- `/operator/dispatch`
- `/operator/acceptance`
- `/operator/evidence`
- `/operator/devices-alerts`
- `/operator/roi-ledger`
- `/operator/field-memory`

## 3. Release Gate 验收命令
执行目录：`C:\Users\mylr1\GEOX`

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

## 4. Gate 判定口径
- 所有命令必须在同一代码快照下通过。
- 任一命令失败，不得标记 P1 Release Gate Done。
- 若存在 allowlist/注释豁免，必须有明确原因且不得出现在客户主界面文案。
