<!-- docs/frontend-productization/PFE-8-STATE-MATRIX.md -->
# PFE-8 State Matrix

## 0. Matrix status

This matrix records state coverage for formal Product Frontend v1 routes. It is a state-expression matrix, not a visual-regression baseline and not a recovery workflow.

| route | surface role | loading | empty | unavailable | permission-limited | degraded | safe error | primitive family | copy check | later owner |
|---|---|---|---|---|---|---|---|---|---|---|
| `/customer/dashboard` | Customer | dashboard summary loading | no summary records | report unavailable | authorized scope limited | partial report | safe report error | Product states | customer-safe copy | PFE-9 |
| `/customer/fields` | Customer | field list loading | no authorized fields | field list unavailable | authorized scope limited | partial list | safe report error | Product states | customer-safe copy | PFE-9 |
| `/customer/fields/:fieldId` | Customer | field report loading | field absent | field report unavailable | authorized scope limited | source degraded | safe report error | Product states | customer-safe copy | PFE-9 |
| `/customer/fields/:fieldId/export` | Customer | export loading | no export rows | export unavailable | authorized scope limited | partial export | safe export error | Product states | return/print safe | PFE-9 |
| `/customer/operations` | Customer | operation list loading | no operations | list unavailable | authorized scope limited | partial list | safe report error | Product states | customer-safe copy | PFE-9 |
| `/customer/operations/:operationId` | Customer | operation report loading | operation absent | report unavailable | authorized scope limited | partial report | safe report error | Product states | customer-safe copy | PFE-9 |
| `/customer/operations/:operationId/export` | Customer | export loading | no export rows | export unavailable | authorized scope limited | partial export | safe export error | Product states | return/print safe | PFE-9 |
| `/customer/reports` | Customer | reports loading | no report categories | center unavailable | authorized scope limited | partial center | safe report error | Product states | customer-safe copy | PFE-9 |
| `/customer/export` | Customer | dashboard export loading | no export rows | export unavailable | authorized scope limited | partial export | safe export error | Product states | return/print safe | PFE-9 |
| `/operator/twin` | Operator | overview loading | source inventory empty | overview unavailable | scope limited | source degraded | safe readback error | Product states | runtime readback copy | PFE-9 |
| `/operator/fields` | Operator | index loading | no runtime fields | index unavailable | scope limited | index degraded | safe readback error | Product states | runtime readback copy | PFE-9 |
| `/operator/fields/:fieldId` | Operator | overview loading | field absent | source unavailable | scope limited | source degraded | safe readback error | Product states | runtime readback copy | PFE-9 |
| `/operator/fields/:fieldId/state` | Operator | state loading | no state estimate | state unavailable | scope limited | state degraded | safe readback error | Product states | runtime readback copy | PFE-9 |
| `/operator/fields/:fieldId/evidence` | Operator | evidence loading | no evidence refs | evidence unavailable | scope limited | evidence degraded | safe readback error | Product states | runtime readback copy | PFE-9 |
| `/operator/fields/:fieldId/forecast` | Operator | forecast loading | no forecast run | forecast unavailable | scope limited | forecast degraded | safe readback error | Product states | runtime readback copy | PFE-9 |
| `/operator/fields/:fieldId/scenario` | Operator | scenario loading | no scenarios | scenario unavailable | scope limited | scenario degraded | safe readback error | Product states | runtime readback copy | PFE-9 |
| `/operator/fields/:fieldId/residual` | Operator | residual loading | no residual rows | residual unavailable | scope limited | residual degraded | safe readback error | Product states | runtime readback copy | PFE-9 |
| `/operator/fields/:fieldId/calibration` | Operator | calibration loading | no review rows | calibration unavailable | scope limited | calibration degraded | safe readback error | Product states | runtime readback copy | PFE-9 |
| `/operator/fields/:fieldId/health` | Operator | health loading | no health rows | health unavailable | scope limited | health degraded | safe readback error | Product states | readback only | PFE-9 |
| `/operator/fields/:fieldId/audit` | Operator | audit loading | no audit rows | audit unavailable | scope limited | audit degraded | safe readback error | Product states | readback only | PFE-9 |
| `/operator/twin/gateway-demo` | Operator | snapshot loading | no snapshot rows | snapshot unavailable | scope limited | replay unavailable | safe readback error | Product states | demo/readback only | PFE-9 |
| `/operator/pilot` | Operator | readiness loading | no readiness rows | readiness unavailable | scope limited | readiness degraded | safe readback error | Product states | readiness readback only | PFE-12 |
| `/admin/dashboard` | Admin | governance loading | no entries | overview unavailable | scope limited | future deferred | safe admin error | Product states | governance readback copy | PFE-9 |
| `/admin/fields` | Admin | fields loading | no rows | readback unavailable | scope limited | readback degraded | safe admin error | Product states | governance readback copy | PFE-9 |
| `/admin/operations` | Admin | operations loading | no rows | readback unavailable | scope limited | readback degraded | safe admin error | Product states | governance readback copy | PFE-9 |
| `/admin/devices` | Admin | inventory loading | no rows | inventory unavailable | scope limited | readback degraded | safe admin error | Product states | governance readback copy | PFE-9 |
| `/admin/evidence` | Admin | evidence loading | no rows | readback unavailable | scope limited | readback degraded | safe admin error | Product states | governance readback copy | PFE-9 |
| `/admin/skills` | Admin | skills loading | no rows | readback unavailable | scope limited | config deferred | safe admin error | Product states | governance readback copy | PFE-9 |
| `/admin/healthz` | Admin | healthz loading | no rows | readback unavailable | scope limited | health route deferred | safe admin error | Product states | governance readback copy | PFE-9 |
| `/login` | Supporting | verification loading | no session | service unavailable | access limited | notice degraded | safe login error | Product states | no raw diagnostic copy | PFE-9 |
