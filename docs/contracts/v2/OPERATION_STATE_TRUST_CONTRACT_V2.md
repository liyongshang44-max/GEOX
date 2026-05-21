# OperationState Trust Contract v2

Status: Proposed / Draft

## Purpose

This contract defines the trust boundary for backend-owned operation state, final status, execution status, acceptance status, and customer-visible eligibility.

This is a proposed trust contract. It does not claim the current OperationState projection already satisfies every field and gate below.

## Backend-owned state rule

Customer/operator pages must not synthesize final operation state from local frontend combinations.

Fields requiring backend-owned source include:

```text
final_status
execution_status
dispatch_status
receipt_status
acceptance_status
customer_visible_eligible
pending_acceptance
evidence_sufficient
device_offline
needs_review
blocking_reasons
invalid_reason
```

## Required trust metadata

Every customer-visible operation state projection should declare:

| field | requirement | fact_confidence | gate_maturity |
| --- | --- | --- | --- |
| source_model | Names backend source model or projection. | proposed | script_exists |
| source_fact_types | Lists fact types used to compute state. | proposed | script_exists |
| projection_rule | Describes deterministic state rule. | proposed | script_exists |
| updated_at | Provides freshness timestamp. | proposed | script_exists |
| freshness | Describes stale or current state. | proposed | script_exists |
| blocking_reasons | Gives customer-safe downgrade reasons. | proposed | script_exists |
| fallback | Declares whether fallback was used. | proposed | script_exists |
| confidence | Describes confidence level. | proposed | script_exists |
| export_same_source | Confirms export uses same source as page. | proposed | script_exists |

## Status interpretation rules

Required interpretation:

```text
receipt success does not force final_status=SUCCESS
receipt success without sufficient evidence may become PENDING_ACCEPTANCE or INVALID_EXECUTION
acceptance PASS may allow customer-visible success only when scenario trust requirements are satisfied
acceptance missing must not be hidden by frontend wording
fallback status must be labeled as fallback
```

## Feature Inventory baseline

| operation state feature | baseline contract | fact_confidence | gate_maturity |
| --- | --- | --- | --- |
| operation_state projection | Backend-owned operation state exists or is targeted. | partially_confirmed | script_exists |
| final_status | Must come from backend-owned state rule. | partially_confirmed | script_exists |
| acceptance.status | Must not be frontend-derived. | partially_confirmed | script_exists |
| invalid execution | Must be represented separately from ordinary failure. | partially_confirmed | script_exists |
| customer_visible_eligible | Must be explicit, not inferred from display text. | proposed | script_exists |
| fallback labeling | Fallback must not masquerade as official state. | proposed | script_exists |

## Gate maturity statement

```text
release gate exists ≠ CI enforced ≠ business correctness proven
```

A static script that scans for frontend status derivation is `script_exists` at most unless CI proves enforcement. A CI step is `ci_enforced` only when it runs in a required workflow. A business correctness claim is forbidden unless runtime scenarios, negative cases, report/export review, and owner sign-off have all been completed.

## Non-goals

This document does not change OperationState projection code, UI status mapping, routes, APIs, database schema, or export behavior.
