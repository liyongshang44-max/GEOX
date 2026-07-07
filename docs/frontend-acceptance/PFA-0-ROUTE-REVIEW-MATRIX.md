<!-- docs/frontend-acceptance/PFA-0-ROUTE-REVIEW-MATRIX.md -->
# PFA-0 Route Review Matrix

Route-level records are stored in `PFA-0-ROUTE-REVIEW-MATRIX.json`.

Matrix v3 stores shared values in `defaults` and route-specific values in `records`. `issueIds` from both levels apply to each route.

```text
30 actual routes
2 locales
3 viewports
180 screenshots
runtime capture: PASS
page quality: FAIL
```

`PFA0-CAP-001` and `PFA0-CAP-002` are resolved by the full authenticated capture. Every actual route now records desktop, laptop, and mobile review coverage.

Each record carries `remediationPhase`. The authoritative sequence is defined in `PFA-POST-FREEZE-TASK-LINE.md`.

`pfa1Required` remains only for compatibility with the earlier matrix schema.