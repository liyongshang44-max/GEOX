# Scenario Contracts v2

Status: Proposed / Draft

## Purpose

This contract defines the baseline for formal GEOX agricultural scenarios. Each scenario must have its own trigger, evidence, acceptance, report, customer wording, and forbidden downstream semantics.

This document is a proposed scenario index. It does not claim all listed scenario contracts are complete.

## Scenario rule

A formal scenario must not be reduced to a generic template.

Required interpretation:

```text
same UI layout ≠ same scenario semantics
inspection accepted ≠ treatment completed
sampling accepted ≠ fertilization completed
irrigation receipt success ≠ irrigation effect accepted
release gate exists ≠ CI enforced ≠ business correctness proven
```

## Formal scenario inventory baseline

| scenario | required chain | fact_confidence | gate_maturity |
| --- | --- | --- | --- |
| formal irrigation | sensing -> recommendation -> prescription -> approval -> AO-ACT -> receipt -> evidence -> acceptance -> report | partially_confirmed | script_exists |
| sampling | request -> sampling task -> receipt -> sample evidence -> acceptance -> report | partially_confirmed | script_exists |
| fertilization | recommendation/prescription -> approval -> AO-ACT or human task -> as-applied evidence -> acceptance -> report | partially_confirmed | script_exists |
| pest disease inspection | request -> observation -> signal -> assessment -> review -> inspection acceptance -> report | partially_confirmed | aggregated_gate_exists |
| device anomaly | telemetry/heartbeat -> diagnosis -> alert/workflow -> operator action -> report | partially_confirmed | script_exists |
| variable operation | zone prescription -> execution/as-applied -> evidence -> acceptance -> report | partially_confirmed | script_exists |

## Required scenario contract sections

Every formal scenario contract should define:

1. Trigger conditions.
2. Required inputs.
3. Evidence basis.
4. Acceptance rule.
5. Customer-visible report fields.
6. Forbidden downstream semantics.
7. Projection source and fallback behavior.
8. Required gates and their `gate_maturity`.
9. Current `fact_confidence`.

## Pest disease inspection boundary

For pest disease inspection:

```text
pest_disease_inspection_acceptance PASS = inspection evidence chain accepted
pest_disease_inspection_acceptance PASS ≠ spray recommendation
pest_disease_inspection_acceptance PASS ≠ spot spray prescription
pest_disease_inspection_acceptance PASS ≠ AO-ACT spray task
pest_disease_inspection_acceptance PASS ≠ dispatch command
pest_disease_inspection_acceptance PASS ≠ ROI
pest_disease_inspection_acceptance PASS ≠ Field Memory
pest_disease_inspection_acceptance PASS ≠ treatment completed
```

## Commercial boundary

A scenario release gate does not make the scenario sale-ready. Commercial readiness still requires customer report review, negative-case proof, operational safety, tenant isolation, auditability, and owner sign-off.

## Non-goals

This document does not modify scenario services, frontend scenario cards, reports, APIs, or acceptance scripts.

## Controlled Pilot sellable scope (PR-4 aligned)

1. `FORMAL_IRRIGATION`
   - status: `pilot_eligible`
   - condition: PR-1 / PR-2 formal evidence + report/dashboard closure passed.
2. `FORMAL_PEST_DISEASE_INSPECTION`
   - status: `pilot_eligible`
   - condition: customer report can show inspection evidence chain; not equivalent to spray/treatment closure.
3. `DEVICE_ANOMALY`
   - status: `pilot_eligible`
   - condition: fail-safe / manual takeover / evidence insufficiency / report-dashboard gating passed.
4. `FORMAL_FERTILIZATION`
   - status: `conditional` / `pending_ci_proof`
   - reason: merged but not counted as Controlled Pilot mandatory scenario until `ci:scenario:fertilization` is green.

