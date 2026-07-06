<!-- docs/frontend-productization/PFE-12-WALKTHROUGH.md -->
# PFE-12 Walkthrough

## Purpose

This is a human walkthrough for the Formal Product Frontend v1 candidate.

## Opening statement

```text
This walkthrough is replay-backed and review-only. The manifest defines the boundary flags.
```

## Path

| step | surface | route | purpose | boundary |
|---:|---|---|---|---|
| 1 | Supporting | `/login` | login and locale toggle | local UI state |
| 2 | Customer | `/customer/dashboard` | customer overview | report view |
| 3 | Customer | `/customer/fields/field_c8_demo` | field report | authorized report |
| 4 | Customer | `/customer/operations/op_plan_c8_irrigation_formal_001` | operation report | report view |
| 5 | Customer | `/customer/export` | export surface | export preview |
| 6 | Operator | `/operator/twin` | runtime overview | read-only review |
| 7 | Operator | `/operator/fields/field_c8_demo/forecast` | field forecast review | review only |
| 8 | Operator | `/operator/twin/gateway-demo` | gateway view | replay-backed |
| 9 | Operator | `/operator/pilot` | pilot readiness | readiness review |
| 10 | Admin | `/admin/dashboard` | governance overview | readback |
| 11 | Admin | `/admin/devices` | device inventory | inventory readback |
| 12 | Admin | `/admin/healthz` | healthz readback | health readback |

## Presenter notes

Use review-only language. Do not describe the candidate as an approved launch or operating deployment.
