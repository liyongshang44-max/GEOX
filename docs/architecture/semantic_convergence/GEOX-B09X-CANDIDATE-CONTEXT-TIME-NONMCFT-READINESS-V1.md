# GEOX B-09x Candidate Context/Time + Non-MCFT Readiness V1

## Status

B-09x is an analysis-only successor stacked on B-09w r1:

`3bee4dd84eaed71d834a253e8997464e89c488f7`.

It does not authorize any Candidate binding, ActionWindow producer, real policy instance,
B-07e connection, or MCFT integration.

## Decision time

No existing source may currently be promoted into canonical
`CandidateDecisionV1.decision_time`.

The bounded recommendation path contains legacy `created_ts`, but B-06c explicitly
records that legacy created timestamps are not promoted.

The persisted `facts.occurred_at` value is assigned by
`INSERT ... occurred_at = NOW()`. It proves persistence time, not the semantic instant
at which the decision boundary became fixed.

Therefore B-09x forbids:

- legacy recommendation `created_ts`;
- persisted recommendation fact `occurred_at`;
- evaluator time;
- wall clock;
- latest fact time;

as implicit Candidate decision-time authority.

A separate product-governance decision must identify a real causal decision boundary.

## ContextSnapshot

B-05b already provides
`projectFieldProgramDeclaredContextV1` and carries one
`DECLARED_FIELD_PROGRAM` assertion with `program_id`.

FieldProgram storage is append-only.

However current product readers resolve Program state using:

`ORDER BY occurred_at DESC, fact_id DESC LIMIT 1`.

That is a latest-state reader, not an as-of decision-time reader.

A future canonical Context binding may use an exact scoped FieldProgram as-of read only
after canonical decision_time exists. The read must be bounded by
`occurred_at <= decision_time`; latest Program state must never be used as causal
Context authority.

## STATE

B-Line already contains the necessary vocabulary and compatibility islands:

- B-06b irrigation `CalculationResultV1` adapters;
- B-07c Agronomy Judge eligibility precursor adapter.

B-07c already enforces the key authority rule:
legacy WATER_DEFICIT/PASS semantics may emit STATE criterion assessments only when
canonical `CalculationResult` refs are supplied.

Current B-09j still has:

`calculation_result_refs = []`.

Therefore STATE is B-Line-local work but is not currently bound.

## ACTION_WINDOW

The repository has:

- Decision Eligibility criterion `ACTION_WINDOW`;
- `action_window_refs` in canonical eligibility inputs;
- B-07d lifecycle rules requiring ActionWindow consistency for non-ACTIVE lifecycle.

No canonical ActionWindow producer or contract provenance is currently established.

B-09x therefore does not invent one. A separate B-Line design/governance decision is
required before a canonical ActionWindow producer is created.

## FORECAST

B-09w recommends FORECAST for the bounded IRRIGATE policy profile.

Canonical Forecast integration remains frozen because MCFT-9 is not complete.

B-Line must not:

- bind MCFT/Twin forecast refs early;
- duplicate MCFT forecast authority;
- create a mock canonical Forecast merely to unblock B-07e;
- modify MCFT provider/scheduler/Formal/Twin/runtime ownership.

Forecast stays `FROZEN_EXTERNAL_DEPENDENCY` until MCFT-9 completion plus separate
integration authorization.

## What B-Line may continue now

Without MCFT completion, B-Line may continue:

1. causal decision-time authority analysis;
2. FieldProgram as-of Context read-model design;
3. CalculationResult/STATE shadow-binding design;
4. ActionWindow contract/provenance design.

It may not yet implement actual Candidate decision_time/context binding, new
ActionWindow authority, a real policy declaration, B-07e runtime connection, consumer
migration, or historical authority removal without the respective governance gates.

## Non-effects

B-09x changes no runtime, route, graph edge, policy fact, Candidate binding, B-07e
connection, MCFT implementation, Approval/Execution authority, consumer migration, or
historical authority.
