# AO-ACT and AO-SENSE Boundary Contract v2

Status: Proposed / Draft

## Purpose

This contract defines the governance boundary between AO-ACT execution chains and AO-SENSE sensing/inspection chains.

This is a proposed baseline. It does not claim every current route, adapter, or report already satisfies these boundaries.

## Boundary rule

AO-ACT and AO-SENSE must remain separate lanes.

Required interpretation:

```text
AO-SENSE receipt success ≠ AO-ACT execution success
AO-SENSE receipt success ≠ inspection acceptance PASS
AO-SENSE receipt success ≠ physical treatment completed
AO-ACT receipt success ≠ acceptance PASS
SkillRun SUCCESS ≠ pest or disease confirmed
release gate exists ≠ CI enforced ≠ business correctness proven
```

## Feature Inventory baseline

| lane | contract behavior | fact_confidence | gate_maturity |
| --- | --- | --- | --- |
| AO-ACT task | Physical or human execution task lane. | partially_confirmed | script_exists |
| AO-ACT receipt | Execution claim and evidence reference lane. | partially_confirmed | script_exists |
| AO-ACT dispatch | Device/human dispatch and retry lane. | partially_confirmed | script_exists |
| AO-SENSE task | Observation or sensing request lane. | partially_confirmed | script_exists |
| AO-SENSE receipt | Observation completion lane, not execution acceptance. | partially_confirmed | script_exists |
| inspection observation | Scenario-domain evidence, not bloated sense receipt payload. | partially_confirmed | script_exists |
| skill run | Diagnostic or capability signal, not authorization or acceptance. | partially_confirmed | script_exists |

## Payload boundary

AO-SENSE receipts may reference observation evidence, but should not become a scenario-specific payload dumping ground.

Allowed target pattern:

```text
sense receipt -> evidence_refs or observation fact refs -> scenario domain projection
```

Forbidden interpretation:

```text
sense receipt contains pest count -> pest confirmed
sense receipt has image ref -> inspection accepted
skill run succeeded -> treatment recommendation authorized
inspection accepted -> AO-ACT spray task created
```

## Gate maturity statement

Any claim about AO-ACT/AO-SENSE separation must carry `gate_maturity`.

| gate claim | PR-0 allowed maturity | fact_confidence |
| --- | --- | --- |
| partition script exists | script_exists | partially_confirmed |
| release gate aggregation | aggregated_gate_exists only when directly aggregated | partially_confirmed |
| CI enforcement | not claimed unless workflow proves it | proposed |
| runtime blocking | not claimed in PR-0 | proposed |
| business correctness proven | not claimed in PR-0 | proposed |

## Non-goals

This document does not change AO-ACT routes, AO-SENSE routes, devices, adapters, executor behavior, or inspection services.
