<!-- docs/frontend-productization/PFE-12-WALKTHROUGH.md -->
# PFE-12 Walkthrough

## Purpose

This is a human walkthrough for the Formal Product Frontend v1 candidate. It is a demo-safe handoff document, not an automation script.

## Opening statement

```text
This walkthrough is replay-backed and review-only. The demo manifest defines the boundary flags, and every production / live / dispatch / pilot-start flag remains false.
```

## Path

| step | surface | route | purpose | boundary | evidence to point at |
|---:|---|---|---|---|---|
| 1 | Supporting | `/login` | login and locale toggle | local UI state | safe login state and zh-CN / en-US toggle |
| 2 | Customer | `/customer/dashboard` | customer overview | report view | customer shell, overview cards, customer-safe copy |
| 3 | Customer | `/customer/fields/field_c8_demo` | field report | authorized report | field report surface and state copy |
| 4 | Customer | `/customer/operations/op_plan_c8_irrigation_formal_001` | operation report | report view | operation report and customer-visible evidence summary |
| 5 | Customer | `/customer/export` | export surface | export preview | print/export surface and safe return path |
| 6 | Operator | `/operator/twin` | runtime overview | read-only review | operator shell, source inventory, nonclaim copy |
| 7 | Operator | `/operator/fields/field_c8_demo/forecast` | field forecast review | review only | Field Runtime route family and forecast review tab |
| 8 | Operator | `/operator/twin/gateway-demo` | gateway view | replay-backed | checked-in snapshot and replay boundary |
| 9 | Operator | `/operator/pilot` | pilot readiness | readiness review | planning and readiness gates only |
| 10 | Admin | `/admin/dashboard` | governance overview | readback | admin shell and governance boundary |
| 11 | Admin | `/admin/devices` | device inventory | inventory readback | device inventory and no-control boundary |
| 12 | Admin | `/admin/healthz` | healthz readback | health readback | readback status and no service-operation boundary |

## Required nonclaims during walkthrough

Say these boundaries clearly when relevant:

```text
This is demo-safe and review-only.
The gateway view is replay-backed.
The operator views are read-only review surfaces.
The pilot page is readiness review only.
The admin pages are governance and readback surfaces.
The customer pages are customer-visible report surfaces.
```

## Forbidden claims during walkthrough

Do not make any of these claims during the demo:

```text
The product is production launched.
A real device is connected.
The production gateway is online.
AO-ACT dispatch is enabled.
A field pilot has started.
The demo controls field equipment.
Admin can restart or operate production services here.
Customer rollout is complete.
Commercial release is complete.
Security certification is complete.
SLA readiness is complete.
```

## Seed review command

Default review command:

```powershell
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FRONTEND_DEMO_V1.cjs --dry-run
```

Manual apply is outside the default PFE-12 walkthrough and must remain a separate explicit operation with an explicit tenant.
