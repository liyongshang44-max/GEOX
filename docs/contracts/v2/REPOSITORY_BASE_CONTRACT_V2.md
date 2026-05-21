# GEOX Repository Base Contract v2

Status: Proposed / Draft
Baseline source: CTO Review Draft v0.3
Scope: governance baseline only

## Purpose

This document freezes Base Contract v2 as the repository governance baseline for subsequent hardening work. It is not a claim that the repository has already completed every v2 contract, trust gate, scenario guarantee, or commercial readiness requirement.

Base Contract v2 is a canonicalization program. Its role is to separate repository facts from target state, and to ensure customer-visible and execution-facing surfaces can be diagnosed, governed, audited, and regression-tested.

## Non-fact statement

The existence of this document or any file under `docs/contracts/v2/*` does not mean the described capability is complete.

Required interpretation:

```text
release gate exists ≠ CI enforced ≠ business correctness proven
script_exists ≠ aggregated_gate_exists ≠ ci_enforced ≠ runtime_blocking_verified ≠ business_correctness_proven
```

## Status rule for all v2 documents

Every document under `docs/contracts/v2/*` must explicitly declare one of the following statuses:

```text
Status: Proposed / Draft
Status: Draft
Status: Proposed
```

No v2 document may describe itself as completed, final, fully implemented, or commercially validated unless the corresponding source code, runtime behavior, CI enforcement, and business-owner validation have been separately proven.

## Fact confidence rule

Every Feature Inventory row must carry `fact_confidence`.

Allowed values:

| fact_confidence | Meaning |
| --- | --- |
| confirmed | Directly backed by a repository path, route, package, script, workflow, or runtime file. |
| partially_confirmed | Some repository evidence exists, but runtime integration, CI enforcement, or business correctness remains unproven. |
| inferred | Reasonable inference from code structure or naming, not yet directly validated. |
| proposed | Target state or new contract requirement, not current repository fact. |

## Gate maturity rule

Every gate, release check, static check, E2E check, or acceptance claim must carry `gate_maturity`.

Allowed values:

| gate_maturity | Meaning |
| --- | --- |
| script_exists | A script or static check exists. |
| aggregated_gate_exists | A script is grouped by a release gate or package script. |
| ci_enforced | CI runs the check as a required PR or main-branch gate. |
| runtime_blocking_verified | The check has been shown to block an incorrect runtime path, merge, or release. |
| business_correctness_proven | Business correctness has been validated through real scenario execution, negative cases, customer report review, and owner sign-off. |

## Feature Inventory baseline

| feature_family | contract surface | baseline requirement | fact_confidence | gate_maturity |
| --- | --- | --- | --- | --- |
| API governance | `/api/v1/*`, OpenAPI, route inventory, error envelope | External APIs must be contract-owned and legacy dependencies must not expand. | partially_confirmed | script_exists |
| Evidence and acceptance | receipts, evidence artifacts, acceptance verdicts | Receipt success, execution completion, and acceptance pass must remain separate. | partially_confirmed | script_exists |
| OperationState trust | final_status, acceptance status, execution state | Customer-visible state must come from backend-owned source/projection. | partially_confirmed | script_exists |
| Projection trust | dashboard, field report, operation report, export | Report/export projections must declare source, freshness, fallback, and blocking reasons. | partially_confirmed | script_exists |
| AO-ACT/AO-SENSE boundary | act task/receipt and sense task/receipt | Sense success must not be interpreted as physical execution success or acceptance pass. | partially_confirmed | script_exists |
| Scenario contracts | irrigation, sampling, fertilization, pest disease inspection | Each formal scenario needs its own trigger, evidence, acceptance, report, and forbidden downstream semantics. | partially_confirmed | script_exists |
| ROI and Field Memory | trust lane boundary | Scenario PASS must not automatically imply ROI realization or learning memory update. | proposed | script_exists |
| Devtools and simulator | seed, helper, simulator, flight-table | Dev/test artifacts must not be treated as customer-official evidence. | proposed | script_exists |
| Release gate maturity | script, aggregation, CI, runtime blocking, business correctness | All gate claims must state maturity explicitly. | proposed | script_exists |

## Commercial readiness boundary

Completing Base Contract v2 does not mean GEOX is ready for general commercial sale.

Commercial readiness requires separate proof of at least:

1. P0 main-chain remediation completion.
2. Dynamic negative gates with `ci_enforced` maturity where required.
3. Multiple formal scenarios passing E2E with negative cases.
4. Production IAM, tenant isolation, audit, secret management, fail-safe, and manual takeover controls.
5. Customer report and export evidence basis that are auditable and same-source.
6. Paid pilot records reviewed by a business owner.

Until those are satisfied, Base Contract v2 should be treated as governed alpha / controlled pilot preparation, not sales readiness.

## PR-0 baseline constraints

This PR must not change business code, UI, API behavior, migrations, runtime behavior, or acceptance semantics. It only adds governance baseline documents.
