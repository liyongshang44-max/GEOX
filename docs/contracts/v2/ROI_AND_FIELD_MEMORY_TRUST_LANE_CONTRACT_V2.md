# ROI and Field Memory Trust Lane Contract v2

Status: Proposed / Draft

## Purpose

This contract defines the trust lane boundary for ROI and Field Memory. It prevents accepted scenario results from being misread as realized economic value or durable learning memory.

This is a proposed boundary contract. It does not claim ROI or Field Memory is commercially complete.

## Trust lane rule

ROI and Field Memory are downstream trust lanes. They require their own source evidence, projection rules, confidence, and review status.

Required interpretation:

```text
acceptance PASS ≠ ROI realized
acceptance PASS ≠ Field Memory learned
inspection PASS ≠ treatment benefit
sampling PASS ≠ yield improvement
recommendation accepted ≠ economic outcome
release gate exists ≠ CI enforced ≠ business correctness proven
```

## ROI baseline

| ROI field | contract requirement | fact_confidence | gate_maturity |
| --- | --- | --- | --- |
| roi_status | Declares unavailable, estimated, measured, or blocked. | proposed | script_exists |
| roi_source | Names source facts/projections. | proposed | script_exists |
| roi_confidence | Separates measured value from estimate. | proposed | script_exists |
| roi_blocking_reasons | Customer-safe explanation when ROI cannot be claimed. | proposed | script_exists |
| roi_customer_copy | Must not imply realized savings without evidence. | proposed | script_exists |

## Field Memory baseline

| Field Memory field | contract requirement | fact_confidence | gate_maturity |
| --- | --- | --- | --- |
| memory_status | Declares none, hypothesis, accepted learning, or blocked. | proposed | script_exists |
| memory_source | Names source evidence and accepted outcome. | proposed | script_exists |
| memory_confidence | Separates hypothesis from durable learning. | proposed | script_exists |
| memory_blocking_reasons | Explains why memory was not updated. | proposed | script_exists |
| memory_customer_copy | Must not imply the system has learned when only a hypothesis exists. | proposed | script_exists |

## Forbidden automatic writes

Unless a downstream trust lane has its own contract and evidence, the following must not happen automatically:

```text
scenario acceptance PASS writes ROI as realized
scenario acceptance PASS writes Field Memory as learned
pest disease inspection PASS writes treatment ROI
pest disease inspection PASS writes disease solved memory
simulator result writes customer-official ROI
helper result writes durable Field Memory
```

## Customer wording boundary

Allowed wording examples:

```text
收益尚未形成可审计结论
当前仅为估算，不代表已兑现收益
本次结果可作为后续观察依据，尚未沉淀为地块记忆
```

Forbidden wording examples unless separately proven:

```text
已节省成本
收益已兑现
系统已经学会
地块风险已解除
```

## Commercial boundary

ROI and Field Memory are high-commercial-impact surfaces. Static checks are not enough for sale readiness. Runtime proof, data lineage, customer review, and owner sign-off are required before customer-facing value claims.

## Non-goals

This document does not change ROI ledger code, Field Memory code, customer reports, UI, APIs, or projections.
