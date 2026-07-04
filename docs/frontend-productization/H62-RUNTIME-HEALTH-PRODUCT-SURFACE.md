<!-- docs/frontend-productization/H62-RUNTIME-HEALTH-PRODUCT-SURFACE.md -->
# H62 Runtime Health Product Surface

H62 implements Runtime Health Product Surface only.

Canonical route is `/operator/fields/:fieldId/health`.

Source is `field_runtime_health_review_v1`.

Mode is `replay_backed_health_review`.

Runtime Health Review is displayed for review only.

H61 Replay Demo remains replay-backed static snapshot only.

Product surface:

```text
Runtime Health
Runtime Health Review
Replay-backed Health Review
Source Freshness
Read Model Availability
Evidence Pipeline
Gateway Snapshot Boundary
Traceability Availability
Nonclaims
Health Boundary
```

Acceptance:

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_H62_RUNTIME_HEALTH_PRODUCT_SURFACE_V1.cjs
pnpm run typecheck:web
pnpm run build:web
```
