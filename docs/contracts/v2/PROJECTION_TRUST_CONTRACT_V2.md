# Projection Trust Contract v2

Status: Proposed / Draft

## Purpose

This contract defines the governance baseline for customer-facing projections, including dashboard, field report, operation report, scenario reports, and exports.

This is a proposed target. It does not claim that all current projections already expose every trust field.

## Projection trust rule

A projection is customer-official only when its source, generation rule, freshness, fallback policy, confidence, and blocking reasons are explicit.

Required interpretation:

```text
projection exists ≠ customer-official
fallback exists ≠ official result
report exists ≠ export same-source proven
release gate exists ≠ CI enforced ≠ business correctness proven
```

## Required projection metadata

| metadata field | requirement | fact_confidence | gate_maturity |
| --- | --- | --- | --- |
| projection_name | Stable projection identifier. | proposed | script_exists |
| source_models | Backend source models. | proposed | script_exists |
| source_fact_types | Facts used by the projection. | proposed | script_exists |
| generation_rule | Deterministic projection rule. | proposed | script_exists |
| freshness | Updated time and stale state. | proposed | script_exists |
| fallback_allowed | Whether fallback may be used. | proposed | script_exists |
| fallback_label | Customer-safe fallback label when used. | proposed | script_exists |
| confidence | Confidence level or reason. | proposed | script_exists |
| blocking_reasons | Customer-safe blockers. | proposed | script_exists |
| customer_visibility_rule | Why this projection may be shown to customers. | proposed | script_exists |
| export_same_source | Export source must match page source. | proposed | script_exists |

## Feature Inventory baseline

| projection surface | target trust contract | fact_confidence | gate_maturity |
| --- | --- | --- | --- |
| customer dashboard | Must declare official or fallback status. | partially_confirmed | script_exists |
| field report | Must declare source and freshness. | partially_confirmed | script_exists |
| operation report | Must declare evidence basis and chain validation. | partially_confirmed | script_exists |
| operation export | Must use same source as operation page. | proposed | script_exists |
| field export | Must use same source as field page. | proposed | script_exists |
| PDI formal scenario report | Must expose observation evidence basis and forbidden downstream semantics. | partially_confirmed | script_exists |
| ROI summary | Must declare whether value is measured, estimated, or unavailable. | proposed | script_exists |
| Field Memory summary | Must declare whether memory is accepted learning or hypothesis. | proposed | script_exists |

## Customer-safe redaction

Customer projections must not expose:

```text
internal object storage paths
local filesystem paths
secrets or tokens
raw debug JSON
unsupported internal identifiers as primary labels
simulator/helper evidence as official evidence without marking
```

## Gate maturity statement

Every projection gate must state `gate_maturity`.

```text
script_exists ≠ aggregated_gate_exists ≠ ci_enforced ≠ runtime_blocking_verified ≠ business_correctness_proven
```

## Non-goals

This document does not change reporting code, export behavior, frontend rendering, APIs, or projection tables.
