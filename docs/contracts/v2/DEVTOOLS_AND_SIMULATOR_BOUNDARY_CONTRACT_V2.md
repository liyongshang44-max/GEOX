# Devtools and Simulator Boundary Contract v2

Status: Proposed / Draft

## Purpose

This contract defines the boundary for devtools, simulator data, seed data, flight-table helpers, and acceptance helpers.

This is a proposed boundary contract. It does not claim all current helper paths already carry complete customer-official exclusion metadata.

## Boundary rule

Devtools and simulator outputs may support development and acceptance, but must not masquerade as customer-official evidence or commercial outcome.

Required interpretation:

```text
simulator result ≠ real field evidence
seed data ≠ customer official record
acceptance helper output ≠ production execution proof
flight-table helper ≠ customer report source
release gate exists ≠ CI enforced ≠ business correctness proven
```

## Feature Inventory baseline

| helper surface | allowed use | customer-official boundary | fact_confidence | gate_maturity |
| --- | --- | --- | --- | --- |
| devtools API | Development and controlled testing. | Must be marked debug/internal/dev-only. | partially_confirmed | script_exists |
| simulator ingest | Scenario simulation and acceptance helper. | Must not become official evidence without explicit marking. | partially_confirmed | script_exists |
| seed data | Demo/bootstrap/acceptance setup. | Must not be sold as real customer data. | partially_confirmed | script_exists |
| flight-table helper | Engineering test planning. | Must not drive customer-visible conclusions. | proposed | script_exists |
| acceptance helper | Test orchestration. | Must not bypass trust gates. | partially_confirmed | script_exists |

## Required marking rule

Any simulated or helper-generated artifact should be traceable with a marking such as:

```text
source_kind=simulated
source_kind=devtools
source_kind=seed
source_kind=acceptance_helper
source_kind=flight_table
customer_official=false
```

The exact schema is a future implementation task. PR-0 only freezes the boundary requirement.

## Customer report exclusion rule

Customer official reports must not present helper outputs as real field outcomes unless a production evidence lane has validated them.

Forbidden customer interpretation:

```text
simulated telemetry proves real irrigation effect
seeded evidence proves real execution
acceptance helper output proves customer work completed
flight-table row proves business correctness
```

## Gate maturity statement

All devtools/simulator restrictions must include `gate_maturity`.

| gate claim | PR-0 allowed maturity | fact_confidence |
| --- | --- | --- |
| helper boundary scan exists | script_exists | partially_confirmed |
| CI enforcement | not claimed unless workflow proves it | proposed |
| runtime segregation | not claimed in PR-0 | proposed |
| business correctness proven | not claimed in PR-0 | proposed |

## Non-goals

This document does not change devtools routes, simulator behavior, seed scripts, acceptance helpers, runtime envs, or customer report filtering.
