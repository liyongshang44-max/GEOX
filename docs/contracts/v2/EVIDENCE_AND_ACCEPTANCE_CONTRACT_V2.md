# Evidence and Acceptance Contract v2

Status: Proposed / Draft

## Purpose

This contract defines the governance baseline for receipts, evidence artifacts, evidence sufficiency, acceptance verdicts, and customer-visible eligibility.

It is a proposed target. It does not claim that all current flows already satisfy these requirements.

## Core boundary

The following statements are mandatory contract rules:

```text
receipt success ≠ acceptance pass
execution complete ≠ acceptance pass
evidence present ≠ evidence sufficient
acceptance PASS ≠ ROI realized
acceptance PASS ≠ Field Memory learned
scenario acceptance PASS ≠ downstream treatment completed
```

## Feature Inventory baseline

| evidence feature | required contract behavior | fact_confidence | gate_maturity |
| --- | --- | --- | --- |
| receipt | Records actor/device/human execution claim and references evidence. | partially_confirmed | script_exists |
| evidence artifact | Stores proof material and metadata. | partially_confirmed | script_exists |
| evidence sufficiency | Determines whether proof is enough for customer-visible conclusion. | proposed | script_exists |
| acceptance verdict | Backend-owned judgment over execution/evidence/result. | partially_confirmed | script_exists |
| customer_visible_eligible | Separate eligibility flag, not equivalent to acceptance result alone. | proposed | script_exists |
| blocking_reasons | Customer-safe reasons explaining why a conclusion is blocked or downgraded. | proposed | script_exists |
| scenario-specific acceptance | Acceptance semantics vary by irrigation, sampling, fertilization, and pest disease inspection. | proposed | script_exists |

## Acceptance semantics

Acceptance must be expressed as a backend-owned result. Frontend code must not infer final acceptance from local combinations of receipt, evidence, or UI labels.

Minimum acceptance payload target:

```text
acceptance.status
acceptance.verdict
acceptance.missing_evidence
acceptance.blocking_reasons
acceptance.customer_visible_eligible
acceptance.source_fact_ids
acceptance.generated_at
acceptance.confidence
```

## Customer report requirement

Customer-facing reports must show both conclusion and basis.

Required customer-safe explanation categories:

1. What was executed or inspected.
2. What evidence was used.
3. What evidence was missing or insufficient.
4. Whether acceptance was passed, failed, pending, or blocked.
5. Why the conclusion is customer-visible or not customer-visible.

## Forbidden downstream interpretation

No acceptance result may automatically generate or imply:

```text
spray recommendation
spot spray prescription
AO-ACT spray task
dispatch command
ROI ledger entry
Field Memory update
treatment completed
risk resolved
```

unless that downstream lane has its own contract, evidence, approval, execution, acceptance, and projection trust.

## Gate maturity statement

All evidence and acceptance gates must state `gate_maturity`.

```text
release gate exists ≠ CI enforced ≠ business correctness proven
```

| gate claim | allowed PR-0 maturity | fact_confidence |
| --- | --- | --- |
| evidence scripts exist | script_exists | partially_confirmed |
| release gate aggregation exists | aggregated_gate_exists only when package script or release script directly aggregates it | partially_confirmed |
| CI enforcement | not claimed unless workflow proves it | proposed |
| runtime blocking | not claimed in PR-0 | proposed |
| business correctness proven | not claimed in PR-0 | proposed |

## Non-goals

This document does not modify acceptance code, evidence code, reporting code, UI, APIs, or database migrations.
