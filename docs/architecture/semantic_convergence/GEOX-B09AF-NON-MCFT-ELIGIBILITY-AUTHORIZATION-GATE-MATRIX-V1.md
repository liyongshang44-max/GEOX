# GEOX B-09af Non-MCFT Eligibility Authorization Gate Matrix V1

## Status

Base: `6c102cb8ef7c361a3cc0ca9fbf04b22b659b8fe8`

Status: `ANALYSIS_ONLY_AUTHORIZATION_MATRIX`

B-09af adds no new semantic design. It reduces the already-qualified B-Line Decision
Eligibility proposals to the smallest useful implementation sequence.

## Immediate non-MCFT gates

### Priority 1 — B-09ae STATE shadow binding

Decision:

`DEC-BLINE-IRRIGATE-STATE-CALCULATION-SHADOW-BINDING-001`

This is the most immediately actionable gate.

If explicitly authorized, it can implement:

- same immutable recommendation skill_trace -> canonical CalculationResult shadow;
- deterministic CalculationResult identity;
- exact Judge/source-input congruence;
- B02 runtime-edge registration;
- the existing B-07c STATE precursor only.

It does not require MCFT and does not require canonical decision_time.

It still does not authorize B-07e, Context/decision-time implementation, Approval,
Execution, migration or authority removal.

### Priority 2 — B-09y decision boundary

Decision:

`DEC-BLINE-CANDIDATE-DECISION-BOUNDARY-001`

This is the next structural gate.

If explicitly authorized, its follow-on work may define and implement the shadow-only
BoundaryEnvelope and causal Context binding:

- canonical Candidate decision_time;
- exact scoped FieldProgram fact binding;
- no latest Program fallback;
- ContextSnapshot as-of binding;
- decision_time propagation into Candidate/Context/Calculation;
- B02 topology.

FORECAST and B-07e remain separate.

## Qualified but not immediately actionable

### B-09w IRRIGATE policy content

The criteria profile is qualified, but a real declaration still requires concrete Program
scope/policy identity and credible support for all required criteria.

### B-09z / B-09ab / B-09ac ActionWindow stack

These proposals are qualified, but a real ActionWindow remains blocked by B-09ad:

`NO_AUTHORIZED_ACTION_SPECIFIC_HORIZON_VALUE_BASIS`

No 6h, 12h, 24h or 72h value may be invented.

## Hard external blocker

FORECAST remains:

`FROZEN_EXTERNAL_DEPENDENCY`

until MCFT-9 is COMPLETE and a separate B-Line-to-MCFT integration decision is authorized.

B-Line does not modify MCFT to accelerate this.

## B-07e remains last

B-07e stays `DISCONNECTED`.

Connection requires one decision boundary with:

- a selected canonical policy;
- Candidate decision_time;
- Context;
- STATE;
- FORECAST;
- ACTION_WINDOW;
- exact provenance/support refs for every required criterion.

No partial/latest fallback is allowed.

## Recommended execution order

1. explicitly authorize and implement B-09ae;
2. explicitly authorize and implement B-09y;
3. re-audit non-MCFT Candidate readiness;
4. resolve ActionWindow numeric product authority separately;
5. wait for MCFT-9 completion and separately authorize Forecast integration;
6. authorize a concrete IRRIGATE policy identity/scope/declaration;
7. prove B-09v selector on bound shadow data;
8. only then request separate B-07e runtime-connection authorization.

## Governance meaning

A generic `continue` instruction is not treated as authorization for any listed decision.

B-09af grants no authorization.

## Non-effects

No runtime, schema, DB, route, graph edge, policy, authorization state, B-07e connection,
MCFT implementation, migration or historical authority changes.
