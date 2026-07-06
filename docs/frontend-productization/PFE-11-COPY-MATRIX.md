<!-- docs/frontend-productization/PFE-11-COPY-MATRIX.md -->
# PFE-11 Copy Matrix

## 0. Matrix status

This matrix records formal copy ownership, copy kind, zh-CN coverage, en-US coverage, and role boundary for PFE-11. It is not a marketing review artifact and not a full localization certification.

| surface | route / component family | copy kind | copy source | zh-CN coverage | en-US coverage | role boundary | forbidden terms checked | known issue | later owner |
|---|---|---|---|---|---|---|---|---|---|
| Customer | `/customer/dashboard` | pageTitle / pageLead / sectionTitle / metricLabel / actionLabel | productSurfaceLabels + customer VMs | yes | yes | customer report and authorized-scope copy | customer internal vocabulary | tone polish deferred | PFE-12 |
| Customer | `/customer/fields` | navigation / pageTitle / emptyState / tableColumn | productSurfaceLabels + customer pages | yes | yes | authorized field report copy | customer internal vocabulary | full page extraction deferred | PFE-12 |
| Customer | `/customer/fields/:fieldId` | pageTitle / pageLead / state copy | productSurfaceLabels + report pages | yes | yes | field report copy | customer internal vocabulary | full page extraction deferred | PFE-12 |
| Customer | `/customer/fields/:fieldId/export` | exportPrint / safeNextAction | productSurfaceLabels + export pages | yes | yes | export and return copy | customer internal vocabulary | browser print copy deferred | PFE-12 |
| Customer | `/customer/operations` | navigation / pageTitle / tableColumn | productSurfaceLabels + operation pages | yes | yes | operation report copy | customer internal vocabulary | full page extraction deferred | PFE-12 |
| Customer | `/customer/operations/:operationId` | pageTitle / pageLead / state copy | productSurfaceLabels + report pages | yes | yes | operation report copy | customer internal vocabulary | full page extraction deferred | PFE-12 |
| Customer | `/customer/operations/:operationId/export` | exportPrint / safeNextAction | productSurfaceLabels + export pages | yes | yes | export and return copy | customer internal vocabulary | browser print copy deferred | PFE-12 |
| Customer | `/customer/reports` | pageTitle / sectionTitle / actionLabel | productSurfaceLabels + reports page | yes | yes | report-center copy | customer internal vocabulary | full page extraction deferred | PFE-12 |
| Customer | `/customer/export` | exportPrint / pageTitle / state copy | productSurfaceLabels + export page | yes | yes | customer export copy | customer internal vocabulary | browser print copy deferred | PFE-12 |
| Operator | `/operator/twin` | shell / navigation / pageTitle / nonclaim | productSurfaceLabels | yes | yes | read-only runtime review | unsafe execution claim | page extraction deferred | PFE-12 |
| Operator | `/operator/fields` | navigation / pageTitle / tableColumn | productSurfaceLabels | yes | yes | source readback copy | unsafe execution claim | page extraction deferred | PFE-12 |
| Operator | `/operator/fields/:fieldId` | pageTitle / tabs / boundary / nonclaim | productSurfaceLabels | yes | yes | field-scoped read-only review | unsafe execution claim | field tab extraction deferred | PFE-12 |
| Operator | `/operator/fields/:fieldId/state` | tab / state / readback | productSurfaceLabels | yes | yes | read-only state review | unsafe execution claim | field tab extraction deferred | PFE-12 |
| Operator | `/operator/fields/:fieldId/evidence` | tab / tableColumn / source copy | productSurfaceLabels | yes | yes | source readback copy | unsafe execution claim | field tab extraction deferred | PFE-12 |
| Operator | `/operator/fields/:fieldId/forecast` | tab / nonclaim / state copy | productSurfaceLabels | yes | yes | forecast is readback, not action | unsafe execution claim | field tab extraction deferred | PFE-12 |
| Operator | `/operator/fields/:fieldId/scenario` | tab / nonclaim / state copy | productSurfaceLabels | yes | yes | scenario is review, not dispatch | unsafe execution claim | field tab extraction deferred | PFE-12 |
| Operator | `/operator/fields/:fieldId/residual` | tab / tableColumn / state copy | productSurfaceLabels | yes | yes | residual readback copy | unsafe execution claim | field tab extraction deferred | PFE-12 |
| Operator | `/operator/fields/:fieldId/calibration` | tab / tableColumn / state copy | productSurfaceLabels | yes | yes | calibration review copy | unsafe execution claim | field tab extraction deferred | PFE-12 |
| Operator | `/operator/fields/:fieldId/health` | tab / status / state copy | productSurfaceLabels | yes | yes | health readback, not monitoring claim | unsafe execution claim | field tab extraction deferred | PFE-12 |
| Operator | `/operator/fields/:fieldId/audit` | tab / tableColumn / state copy | productSurfaceLabels | yes | yes | audit readback copy | unsafe execution claim | field tab extraction deferred | PFE-12 |
| Operator | `/operator/twin/gateway-demo` | pageTitle / nonclaim / tableColumn | productSurfaceLabels | yes | yes | replay-backed demo, not live control | unsafe execution claim | page extraction deferred | PFE-12 |
| Operator | `/operator/pilot` | pageTitle / nonclaim / tableColumn | productSurfaceLabels | yes | yes | readiness review, not field work | unsafe execution claim | page extraction deferred | PFE-12 |
| Admin | `/admin/dashboard` | shell / navigation / pageTitle / boundary | productSurfaceLabels | yes | yes | governance readback | admin service operation claim | page extraction deferred | PFE-12 |
| Admin | `/admin/fields` | navigation / tableColumn / state copy | productSurfaceLabels | yes | yes | governance readback | admin service operation claim | page extraction deferred | PFE-12 |
| Admin | `/admin/operations` | navigation / tableColumn / state copy | productSurfaceLabels | yes | yes | governance readback | admin service operation claim | page extraction deferred | PFE-12 |
| Admin | `/admin/devices` | navigation / tableColumn / state copy | productSurfaceLabels | yes | yes | inventory readback | admin service operation claim | page extraction deferred | PFE-12 |
| Admin | `/admin/evidence` | navigation / tableColumn / state copy | productSurfaceLabels | yes | yes | governance readback | admin service operation claim | page extraction deferred | PFE-12 |
| Admin | `/admin/skills` | navigation / tableColumn / state copy | productSurfaceLabels | yes | yes | registry readback | admin service operation claim | page extraction deferred | PFE-12 |
| Admin | `/admin/healthz` | navigation / status / state copy | productSurfaceLabels | yes | yes | healthz readback | admin service operation claim | page extraction deferred | PFE-12 |
| Supporting | `/login` | formLabel / loadingState / errorState / ariaLabel | LoginPage + Locale primitives | yes | yes | safe auth state copy | raw diagnostic copy | full auth copy extraction deferred | PFE-12 |
| Supporting | `LocaleToggle` | ariaLabel / actionLabel | LocaleToggle + LocaleProvider | yes | yes | local locale state only | navigation mutation copy | no issue | PFE-12 |
| Supporting | `RuntimeTextGuard` | fallback copy | RuntimeTextGuard | limited | limited | fallback only | replacement growth | must not become catalog | PFE-12 |
