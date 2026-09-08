# GEOX B-09z ActionWindow Semantics Decision Package V1

## Status

B-09z is stacked exactly on completed B-09y proposal head:

`28b5809efefc94440cf9766f03d5b6f7d2b5944c`.

Decision:

`DEC-BLINE-ACTION-WINDOW-SEMANTICS-001`

Current state:

`RECOMMENDED_NOT_AUTHORIZED`.

This phase defines the semantics of the future canonical Decision Eligibility
`ACTION_WINDOW` input. It creates no runtime producer or ActionWindow instance.

## Semantic question

The canonical question is:

> For how long, and from what instant, may one canonical Candidate remain eligible
> to proceed toward Approval?

This is intentionally upstream of Approval and Execution.

## Canonical semantic type

Proposed contract name:

`DecisionActionWindowV1`

Authority state:

`ELIGIBILITY_ACTION_WINDOW_ONLY`

This window is not:

- an AO-ACT task/authorization time window;
- an execution schedule or dispatch window;
- a ProblemState evidence/lifecycle window;
- a Twin candidate-pointer calibration/review use window;
- a model activation/canary window;
- a policy effective window;
- an MCFT forecast/evidence/runtime window.

## Required shape

A canonical ActionWindow must have:

- one canonical Candidate ref;
- exact canonical scope;
- canonical decision_time;
- finite window_start;
- finite window_end;
- window_start < window_end;
- window_start >= decision_time;
- selected eligibility policy_ref;
- explicit horizon_source_ref;
- immutable support_refs;
- explicit deterministic evaluation time.

Open-ended windows are forbidden.

## Lifecycle semantics

Given explicit `evaluated_at`:

- `evaluated_at < window_start` → `NOT_YET_ACTIVE`
- `window_start <= evaluated_at < window_end` → `ACTIVE`
- `evaluated_at >= window_end` → `EXPIRED`
- missing, invalid or ambiguous provenance → `UNKNOWN`

Criterion mapping:

- ACTIVE → ACTION_WINDOW = SATISFIED, only when provenance/support refs are valid
- EXPIRED → ACTION_WINDOW = VIOLATED
- UNKNOWN → ACTION_WINDOW = UNKNOWN
- NOT_YET_ACTIVE → never SATISFIED; exact later mapping may be UNKNOWN/MISSING under B-07d lifecycle policy

The pure evaluator must not call hidden wall clock / Date.now().

## No hidden default horizon

B-09z explicitly does not define a 6h, 12h, 24h or any other default duration.

A fixed duration hidden in code would itself be product policy.

Therefore a real ActionWindow requires an independently governed
`horizon_source_ref`.

Current authorized horizon source:

`NONE`.

The future horizon authority may be policy-bound, agronomic, operational-governance,
or a composition of explicitly authorized sources, but B-09z does not choose that
authority.

## Relationship to B-09y

B-09y Decision Boundary is the causal lower-bound anchor.

A real ActionWindow cannot be instantiated until the Decision Boundary semantics are
authorized and bound.

The decision_time anchors causality; it does not determine the window duration.

## Relationship to B-09w

B-09w proposes ACTION_WINDOW as a required criterion for the bounded IRRIGATE policy.

B-09z does not authorize that policy content and does not create a policy declaration.

The selected eligibility `policy_ref` must be included in ActionWindow provenance, but
the current policy declaration contract does not encode an actionability duration.

Policy effective_from/effective_until is policy applicability lifecycle. It is not the
Candidate ActionWindow.

## Rejected reuse candidates

### P47 AO-ACT time window

This belongs to downstream AO-ACT authorization/task envelope semantics. It is not
Eligibility ActionWindow authority.

### P35 Twin candidate expiry/use window

This governs Twin candidate-pointer calibration/review use. It does not govern whether a
B-Line Candidate may proceed toward Approval.

### P44 activation window

This governs model activation/canary lifecycle, a different authority domain.

### ProblemStateV1.window

This is an evidence/problem lifecycle window. Its frozen documentation explicitly limits
reuse semantics and does not make it an execution trigger.

### MCFT/Twin windows

Forecast, evidence, Formal and scheduler windows belong to MCFT/Twin scientific/runtime
semantics. MCFT-9 is incomplete and B-Line must not reuse those windows as Eligibility
ActionWindow authority.

## Authorization effect

Accepting `DEC-BLINE-ACTION-WINDOW-SEMANTICS-001` would authorize only:

- the semantic separation above;
- the finite-interval/lifecycle rules;
- the requirement for explicit horizon authority;
- later contract/topology design under B02.

It would not authorize:

- a hardcoded/default horizon;
- a production ActionWindow producer;
- a real ActionWindow instance;
- B-09y boundary implementation;
- B-09w real policy declaration;
- B-07e connection;
- Approval/AO-ACT/Execution changes;
- MCFT/Twin integration;
- consumer migration;
- authority removal.

## Non-effects

B-09z creates no runtime, schema, database, route, graph edge, ActionWindow instance,
B-07e connection, MCFT change, migration, Approval/Execution change or historical
authority removal.
