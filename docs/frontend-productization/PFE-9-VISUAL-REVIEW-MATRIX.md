<!-- docs/frontend-productization/PFE-9-VISUAL-REVIEW-MATRIX.md -->
# PFE-9 Visual Review Matrix

## 0. Matrix status

This matrix maps the PFE-9 screenshot manifest into review expectations. It is not a pixel-diff oracle and not a designer sign-off artifact.

| route | surface | baseline subset | desktopWide | desktopStandard | laptop | tablet | mobileNarrow | expected shell | expected main state | expected table/card behavior | expected export/print behavior | known visual risk | later owner |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|
| `/customer/dashboard` | Customer | yes | capture | manifest | manifest | capture | capture | Customer shell visible | dashboard summary visible | cards and right rail readable | n/a | dense dashboard content | PFE-10 |
| `/customer/fields` | Customer | yes | capture | manifest | manifest | capture | capture | Customer shell visible | field list visible | list cards readable | n/a | long field labels | PFE-10 |
| `/customer/fields/:fieldId` | Customer | yes | capture | manifest | manifest | capture | capture | Customer shell visible | field report visible | report cards readable | n/a | long report metadata | PFE-10 |
| `/customer/fields/:fieldId/export` | Customer | no | manifest | manifest | manifest | manifest | manifest | export surface visible | export content visible | print layout readable | print/return controls visible | browser print behavior | PFE-10 |
| `/customer/operations` | Customer | no | manifest | manifest | manifest | manifest | manifest | Customer shell visible | operation list visible | list cards readable | n/a | long operation names | PFE-10 |
| `/customer/operations/:operationId` | Customer | no | manifest | manifest | manifest | manifest | manifest | Customer shell visible | operation report visible | report cards readable | n/a | long operation metadata | PFE-10 |
| `/customer/operations/:operationId/export` | Customer | no | manifest | manifest | manifest | manifest | manifest | export surface visible | export content visible | print layout readable | print/return controls visible | browser print behavior | PFE-10 |
| `/customer/reports` | Customer | no | manifest | manifest | manifest | manifest | manifest | Customer shell visible | reports center visible | category cards readable | n/a | category wrapping | PFE-10 |
| `/customer/export` | Customer | yes | capture | manifest | manifest | capture | capture | export surface visible | dashboard export visible | print layout readable | print/return controls visible | browser print behavior | PFE-10 |
| `/operator/twin` | Operator | yes | capture | manifest | manifest | capture | capture | Operator shell visible | twin overview visible | cards readable | n/a | dense readback copy | PFE-10 |
| `/operator/fields` | Operator | yes | capture | manifest | manifest | capture | capture | Operator shell visible | field index visible | list/table readable | n/a | long identifiers | PFE-10 |
| `/operator/fields/:fieldId` | Operator | no | manifest | manifest | manifest | manifest | manifest | Operator shell visible | overview visible | cards readable | n/a | runtime tab density | PFE-10 |
| `/operator/fields/:fieldId/state` | Operator | no | manifest | manifest | manifest | manifest | manifest | Operator shell visible | state panel visible | state rows readable | n/a | long state values | PFE-10 |
| `/operator/fields/:fieldId/evidence` | Operator | no | manifest | manifest | manifest | manifest | manifest | Operator shell visible | evidence panel visible | evidence rows readable | n/a | evidence ref wrapping | PFE-10 |
| `/operator/fields/:fieldId/forecast` | Operator | yes | capture | manifest | manifest | capture | capture | Operator shell visible | forecast panel visible | forecast cards readable | n/a | forecast table density | PFE-10 |
| `/operator/fields/:fieldId/scenario` | Operator | no | manifest | manifest | manifest | manifest | manifest | Operator shell visible | scenario panel visible | scenario cards readable | n/a | comparison density | PFE-10 |
| `/operator/fields/:fieldId/residual` | Operator | no | manifest | manifest | manifest | manifest | manifest | Operator shell visible | residual panel visible | residual rows readable | n/a | calibration labels | PFE-10 |
| `/operator/fields/:fieldId/calibration` | Operator | no | manifest | manifest | manifest | manifest | manifest | Operator shell visible | calibration panel visible | review cards readable | n/a | review status density | PFE-10 |
| `/operator/fields/:fieldId/health` | Operator | no | manifest | manifest | manifest | manifest | manifest | Operator shell visible | health panel visible | health rows readable | n/a | health readback density | PFE-10 |
| `/operator/fields/:fieldId/audit` | Operator | no | manifest | manifest | manifest | manifest | manifest | Operator shell visible | audit panel visible | audit rows readable | n/a | long audit refs | PFE-10 |
| `/operator/twin/gateway-demo` | Operator | yes | capture | manifest | manifest | capture | capture | Operator shell visible | gateway demo visible | demo cards readable | n/a | demo density | PFE-10 |
| `/operator/pilot` | Operator | yes | capture | manifest | manifest | capture | capture | Operator shell visible | pilot readiness visible | readiness cards readable | n/a | readiness card density | PFE-10 |
| `/admin/dashboard` | Admin | yes | capture | manifest | manifest | capture | capture | Admin shell visible | dashboard visible | governance cards readable | n/a | admin metric density | PFE-10 |
| `/admin/fields` | Admin | no | manifest | manifest | manifest | manifest | manifest | Admin shell visible | field governance visible | table/card readable | n/a | governance labels | PFE-10 |
| `/admin/operations` | Admin | no | manifest | manifest | manifest | manifest | manifest | Admin shell visible | operation governance visible | table/card readable | n/a | governance labels | PFE-10 |
| `/admin/devices` | Admin | yes | capture | manifest | manifest | capture | capture | Admin shell visible | device inventory visible | table/card readable | n/a | device id wrapping | PFE-10 |
| `/admin/evidence` | Admin | no | manifest | manifest | manifest | manifest | manifest | Admin shell visible | evidence governance visible | table/card readable | n/a | evidence id wrapping | PFE-10 |
| `/admin/skills` | Admin | no | manifest | manifest | manifest | manifest | manifest | Admin shell visible | skills registry visible | table/card readable | n/a | registry density | PFE-10 |
| `/admin/healthz` | Admin | yes | capture | manifest | manifest | capture | capture | Admin shell visible | healthz visible | health cards readable | n/a | health label wrapping | PFE-10 |
| `/login` | Supporting | yes | capture | manifest | manifest | capture | capture | login card visible | auth state visible | form readable | n/a | small-screen form spacing | PFE-10 |
