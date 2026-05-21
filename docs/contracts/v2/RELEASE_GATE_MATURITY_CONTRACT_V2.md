# Release Gate Maturity Contract v2

Status: Proposed / Draft

## Purpose

This contract defines how GEOX describes scripts, release gates, CI checks, runtime blocking, and business correctness claims.

This is a governance baseline. It does not claim all current gates are CI-enforced or business-validating.

## Mandatory distinction

All future governance documents, task books, PR descriptions, and release notes must preserve this distinction:

```text
release gate exists ≠ CI enforced ≠ business correctness proven
script_exists ≠ aggregated_gate_exists ≠ ci_enforced ≠ runtime_blocking_verified ≠ business_correctness_proven
```

## Allowed gate_maturity values

| gate_maturity | Definition | Evidence required |
| --- | --- | --- |
| script_exists | A script, static check, test, or executable check exists. | Repository path to the script/check. |
| aggregated_gate_exists | A higher-level release gate or package script invokes the check. | Package script or release gate showing aggregation. |
| ci_enforced | CI runs the check as part of a required workflow. | Workflow path and required-check evidence. |
| runtime_blocking_verified | The check or runtime control blocks an incorrect path, merge, deploy, or release. | Negative-case execution evidence. |
| business_correctness_proven | Business correctness was proven with real scenario execution, negative cases, customer report review, and owner sign-off. | Runtime evidence, report evidence, and owner approval. |

## Fact confidence for gates

Every gate table must also include `fact_confidence`.

| fact_confidence | Gate interpretation |
| --- | --- |
| confirmed | The exact script, workflow, or path was directly verified. |
| partially_confirmed | A related script or workflow exists, but enforcement or coverage remains incomplete. |
| inferred | Coverage is inferred from naming or structure only. |
| proposed | Target gate or desired maturity, not current fact. |

## Required gate table shape

Any future gate matrix should use this shape:

| gate_id | script_or_workflow | invariant | fact_confidence | gate_maturity | notes |
| --- | --- | --- | --- | --- | --- |
| example | `scripts/example.cjs` | Example invariant. | confirmed | script_exists | Do not claim CI enforcement without workflow proof. |

## Claims prohibited without evidence

The following claims require evidence and must not be used casually:

```text
fully covered
CI enforced
release blocking
runtime blocking
business correctness proven
commercially ready
production ready
customer validated
```

## Commercial readiness boundary

Base Contract v2 completion is not commercial readiness.

Commercial readiness requires separate proof of:

1. P0 main-chain remediation completion.
2. Required negative gates with `ci_enforced` maturity.
3. Formal scenarios proven through runtime E2E and negative cases.
4. Production IAM, tenant isolation, audit, secrets, fail-safe, and manual takeover.
5. Customer report and export evidence basis review.
6. Paid pilot or owner-reviewed pilot outcome.

## PR-0 maturity statement

For PR-0, all new `docs/contracts/v2/*` documents are governance baseline documents only.

| artifact | fact_confidence | gate_maturity |
| --- | --- | --- |
| v2 contract documents | proposed | script_exists |
| PR-0 grep validation | proposed | script_exists |
| business correctness proven | proposed | not claimed |

## Non-goals

This document does not create, modify, or enforce CI workflows. It does not modify release scripts, business code, APIs, UI, database migrations, or runtime behavior.
