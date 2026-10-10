# GEOX B-09y Candidate Decision Boundary Authority Decision Package V1

## Status

B-09y is stacked exactly on completed B-09x analysis head:

`6a3d869b7658e0733af2f74b15d291e738ae890a`.

Decision:

`DEC-BLINE-CANDIDATE-DECISION-BOUNDARY-001`

Current state:

`RECOMMENDED_NOT_AUTHORIZED`.

This phase proposes the authority semantics for one future canonical
`CandidateDecisionV1.decision_time`.

It does not modify recommendation runtime and creates no boundary fact.

## Why a timestamp alone is insufficient

The current bounded recommendation path exposes several timestamps, but none is a valid
canonical decision boundary today.

Legacy recommendation `created_ts` is explicitly not promoted by B-06c.

The recommendation fact `occurred_at` is assigned by persistence:

`INSERT ... occurred_at = NOW()`.

It proves when the fact was stored, not when the decision input set became fixed.

The current `decision_recommendation_input_facts_v1` fact is also persisted after
recommendation computation has already occurred. Its `occurred_at` cannot be
retroactively promoted into decision_time.

Wall clock, request arrival time, evaluator time and latest fact time remain forbidden.

## Proposed authority: Canonical Decision Boundary Envelope

The proposed v1 authority is one server-created immutable boundary envelope per canonical
Candidate.

Its authority is:

`BOUNDARY_ONLY`.

The caller cannot submit decision_time.

The envelope freezes one causal boundary after all canonical Candidate-affecting input
acquisition and binding is complete, and before canonical Candidate computation begins.

The same decision_time must propagate to:

- `CandidateDecisionV1.decision_time`;
- `ContextSnapshotV1.decision_time`;
- `CalculationResultV1.decision_time`;
- future ActionWindow derivation;
- B-09v policy selection;
- future `DecisionEligibilityDecisionV1.decision_time`.

## Post-boundary read rule

After the boundary is frozen, no later read may change canonical Candidate fields unless:

1. the read is explicitly bounded as-of the same decision_time; and
2. its immutable support ref is recorded in the boundary envelope.

This prevents a nominal decision_time from coexisting with hidden latest-state reads.

## Program and Context binding

The current legacy route may resolve Program in two ways:

1. explicit `rec.program_id`;
2. field/season fallback using `ORDER BY occurred_at DESC LIMIT 1`.

The second form is forbidden for canonical Context and policy anchoring.

The recommended v1 canonical path requires an explicit Program selector. The selector is
only a lookup key supplied to the server; it is not authority.

The server must validate it against one exact scoped immutable FieldProgram fact using:

- tenant;
- project;
- group;
- field;
- season.

Zero matching Program context fails closed.

Ambiguous Program identity fails closed.

There is no latest-wins rule for canonical Program binding.

The exact FieldProgram fact identity, not only `program_id`, must be preserved in
canonical Context provenance.

## Current decision-engine read order

The bounded route currently reads:

- refreshed Stage-1/sensing/fertility read models;
- derived sensing states;
- weather forecast;

before recommendation generation.

It later reads rule-performance scores and may call
`resolveProgramIdForRecommendation`.

Current rule-score outputs are ranking/debug metadata from the perspective of the B-06c
Candidate projection; B-09y does not promote them into canonical Candidate semantics.
If that changes in the future, those reads must move inside the governed boundary model.

Program resolution is different: it changes Program provenance. Therefore canonical
binding cannot use the current field/season latest fallback after a boundary is declared.

## Required boundary refs

A future boundary envelope must bind exact immutable refs for the canonical source inputs
used by the Candidate path.

At minimum, when applicable:

- canonical EvidenceQualification refs;
- exact FieldProgram fact ref;
- canonical ContextSnapshot ref;
- exact source input refs used by Candidate computation;
- canonical Forecast refs once MCFT is complete.

If Forecast refs are absent, the proposed B-09w FORECAST criterion cannot be SATISFIED.
B-09y does not create a fake Forecast authority.

## Explicitly forbidden sources

B-09y forbids using any of the following as implicit decision_time authority:

- legacy recommendation `created_ts`;
- recommendation fact `occurred_at`;
- current recommendation-input fact `occurred_at`;
- request arrival time;
- Candidate wall-clock fallback;
- `evaluated_at`;
- latest persisted fact time.

## If this decision is authorized

Authorization would permit only the BoundaryEnvelope contract/topology design and later
shadow implementation under B02.

It would not authorize:

- a production B-07e connection;
- a real Eligibility policy declaration;
- MCFT/Twin Forecast binding;
- Approval or Execution changes;
- consumer migration;
- historical authority removal.

## Non-effects

B-09y creates no runtime, schema, database, route, Candidate binding, Context binding,
boundary fact, policy fact, B-07e connection, MCFT change, consumer migration or authority
removal.
