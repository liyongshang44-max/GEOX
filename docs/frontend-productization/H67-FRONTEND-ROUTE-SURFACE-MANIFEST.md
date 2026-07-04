# H67 Frontend Route Surface Manifest

This manifest records the formal frontend product surfaces for Frontend Runtime Console v1 release readiness.

## Operator Runtime Console

Formal routes:

- `/operator/twin`
- `/operator/fields`
- `/operator/fields/:fieldId`
- `/operator/fields/:fieldId/evidence`
- `/operator/fields/:fieldId/state`
- `/operator/fields/:fieldId/forecast`
- `/operator/fields/:fieldId/scenario`
- `/operator/fields/:fieldId/residual`
- `/operator/fields/:fieldId/calibration`
- `/operator/fields/:fieldId/health`
- `/operator/fields/:fieldId/audit`
- `/operator/twin/gateway-demo`
- `/operator/pilot`

Boundary:

- Read-only review surface.
- Replay-backed or checked-in snapshot where applicable.
- No live device claim.
- No production gateway online claim.
- No field pilot execution claim.
- Controlled execution remains disabled.
- No recommendation creation claim.
- No fact persistence claim from these surfaces.
- No value ledger mutation claim.
- No long-term field record mutation claim.

## Customer Portal

Formal routes:

- `/customer/dashboard`
- `/customer/fields`
- `/customer/fields/:fieldId`
- `/customer/fields/:fieldId/export`
- `/customer/operations`
- `/customer/operations/:operationId`
- `/customer/operations/:operationId/export`
- `/customer/reports`
- `/customer/export`

Boundary:

- Customer-visible reporting only.
- Route table owns page selection.
- CustomerLayout is shell-only.
- No operational command surface.
- No admin route ownership.
- No debug route in formal navigation.
- No internal value ledger route in formal navigation.
- No long-term field memory route in formal navigation.

## Admin Console

Formal routes:

- `/admin/dashboard`
- `/admin/fields`
- `/admin/operations`
- `/admin/devices`
- `/admin/evidence`
- `/admin/skills`
- `/admin/healthz`

URL-only and compatibility routes:

- `/admin/alerts`
- `/admin/acceptance`
- `/admin/import`
- `/admin/operations/:operationId/debug`

Boundary:

- Internal governance shell.
- AdminLayout is an independent shell.
- Formal navigation excludes debug, import, and acceptance.
- No new runtime mutation workflow.
- No backend mutation is added by H67.
