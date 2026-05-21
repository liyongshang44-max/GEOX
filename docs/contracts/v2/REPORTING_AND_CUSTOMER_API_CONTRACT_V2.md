# Reporting and Customer API Contract v2

Status: Proposed / Draft

## Purpose

This contract defines the governance baseline for customer-facing reports, customer APIs, operation reports, field reports, dashboard summaries, and exports.

This document is not a statement that the current customer APIs are final or commercially complete.

## Customer report rule

Customer-facing output must be backend-owned, evidence-based, customer-safe, and same-source with export.

Required interpretation:

```text
page rendered ≠ export same-source proven
API exists ≠ official customer contract complete
projection exists ≠ customer-visible eligibility proven
release gate exists ≠ CI enforced ≠ business correctness proven
```

## Official and transitional surfaces

| surface | target status | fact_confidence | gate_maturity |
| --- | --- | --- | --- |
| operation report API | official customer report target | partially_confirmed | script_exists |
| field report API | official customer report target | partially_confirmed | script_exists |
| customer dashboard aggregate | must be explicitly classified as official or transitional before sales use | partially_confirmed | script_exists |
| operation export | must be same-source with operation page | proposed | script_exists |
| field export | must be same-source with field page | proposed | script_exists |
| scenario report cards | must be scenario-specific and not generic template leakage | partially_confirmed | script_exists |

## Required customer report fields

Customer reports should expose:

```text
operation or field identity
customer-safe status
backend-owned final_status or equivalent
acceptance state
evidence basis
blocking_reasons
customer_visible_eligible
projection source
freshness or generated_at
fallback label when fallback is used
export_same_source assertion
```

## Pest disease inspection reporting requirement

For pest disease inspection, customer reports must show inspection evidence basis, not just conclusion.

Required evidence categories:

```text
which media or image evidence exists
when evidence was captured
where evidence was captured
which device or scout produced it
field note or scout note
incidence, severity, and affected-area values when available
evidence quality
human review state
acceptance state
boundary statement that inspection acceptance is not treatment completion
```

Forbidden customer claims unless separate treatment execution chain proves them:

```text
已喷药
已防治
防治完成
喷药完成
病虫害已解决
作物风险已解除
防治效果已达成
```

## Feature Inventory baseline

| report feature | contract requirement | fact_confidence | gate_maturity |
| --- | --- | --- | --- |
| customer-safe language | No raw engineering status as primary copy. | partially_confirmed | script_exists |
| evidence basis visibility | Customer can see why a conclusion was reached. | proposed | script_exists |
| export same-source | Export must use the same backend source as page. | proposed | script_exists |
| redaction | No secrets, local paths, internal object paths, or raw debug payloads. | proposed | script_exists |
| fallback marking | Transitional/fallback data must be labeled. | proposed | script_exists |

## Commercial boundary

A customer report that passes static checks is not automatically sale-ready. Commercial readiness requires runtime scenario proof, negative cases, customer-safe review, and owner sign-off.

## Non-goals

This document does not alter report APIs, frontend pages, export generation, projection logic, or labels.
