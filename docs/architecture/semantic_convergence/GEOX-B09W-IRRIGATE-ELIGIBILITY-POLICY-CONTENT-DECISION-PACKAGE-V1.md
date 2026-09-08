# GEOX B-09w IRRIGATE Eligibility Policy Content Decision Package V1

## Status

B-09w is stacked exactly on completed B-09v product head:

`cce900dfd4e9f412506c3988b3d63ff531ee56bb`.

Decision package:

`DEC-BLINE-IRRIGATE-ELIGIBILITY-POLICY-CONTENT-001`

Current state:

`RECOMMENDED_NOT_AUTHORIZED`.

This phase proposes the first bounded product Decision Eligibility policy content profile.
It creates no policy declaration fact and does not connect B-07e.

## Bounded product path

The proposal applies only to the formal product recommendation path:

`POST /api/v1/recommendations/generate`

for exact action string:

`IRRIGATE`.

It does not define a repository-wide action enum.

## Proposed baseline policy profile

Profile name:

`IRRIGATE_BASELINE_ELIGIBILITY_V1`

Recommended policy version:

`v1`

A concrete real declaration still needs one stable safe `policy_id` unique to one
Program policy lineage. B-09w intentionally does not invent a concrete Program instance
or policy_ref.

The selector scope remains the already-authorized B-09v boundary:

`CandidateDecision -> ContextSnapshot -> exactly one DECLARED_FIELD_PROGRAM -> program_id`

with exact nullable scope equality. Null is not a wildcard.

## Proposed required criteria

The proposed baseline required criteria are:

1. `QUALIFIED_EVIDENCE`
2. `CONTEXT`
3. `STATE`
4. `FORECAST`
5. `ACTION_WINDOW`

This set is selected from product semantics, not from what is currently easiest to wire.

### QUALIFIED_EVIDENCE

Irrigation must not proceed toward Approval when its observations are physically,
temporally, spatially, or source-authority ineligible at decision time.

B-09g/h/j already prove canonical EvidenceQualification reference continuity on the
bounded shadow path.

Current readiness: `READY_SHADOW_BOUND`.

### CONTEXT

Irrigation amount and policy applicability depend on canonical field/season/Program
context. B-09v policy selection itself requires the canonical ContextSnapshot Program
anchor.

Current readiness: the B-05b capability exists, but the current B-09j Candidate still has
`context_snapshot_ref = null`.

### STATE

The decision must carry canonical support that an irrigation requirement actually exists.
B-07c explicitly requires canonical CalculationResult refs for WATER_DEFICIT/PASS state
projection and forbids promoting legacy Judge outputs.

Current readiness: canonical CalculationResult support is not bound on the analyzed path.

### FORECAST

The bounded irrigation generator directly reads weather forecast and feeds rainfall and
ET0 into irrigation deficit/requirement reasoning. Therefore forecast quality cannot be
silently absent from Eligibility.

A missing or degraded canonical forecast may later produce NEED_EVIDENCE or DEGRADED
rather than being hidden.

Current readiness: no canonical product Forecast binding is established. Legacy weather
projection is not promoted, and B-Line does not touch MCFT/Twin forecast authority.

### ACTION_WINDOW

Irrigation is time-sensitive. A candidate that was responsible at decision time can become
not-yet-active, expired, or otherwise outside its actionability window.

B-07d already requires ACTION_WINDOW consistency for non-ACTIVE lifecycle states.

Current readiness: canonical ActionWindow provenance is not established.

## Criteria deliberately excluded from baseline v1

`SCENARIO` is excluded because the bounded IRRIGATE path has no separately proven
canonical scenario dependency beyond State plus Forecast.

`KNOWLEDGE_POLICY` is excluded because no canonical product knowledge-policy binding
exists on this bounded path.

`PERMISSION` is excluded because FieldProgram execution policy and human Approval are
downstream authorities and must not be renamed as pre-decision permission.

`CONSEQUENCE` and `REVERSIBILITY` remain possible later risk-tier criteria, but there
is no canonical bounded-path assessment binding today.

`REMAINING_UNCERTAINTY` is not required because B-07d already derives remaining
uncertainty from non-satisfied criterion states; making it a required input would be
circular.

`INDEPENDENT_EVIDENCE_SUPPORT` remains a possible high-assurance profile extension,
but B-09w does not justify it as a universal baseline requirement for every irrigation
Program.

## Applicability and lifecycle

`applicable_action_types = ["IRRIGATE"]`.

Lifecycle semantics remain:

`B07D_LIFECYCLE_STATE_V1`.

A real declaration must explicitly choose an effective window and may not become
effective before server-assigned declaration time.

No hidden effective-time default is created here.

## What accepting this decision would mean

Acceptance would authorize only the bounded IRRIGATE baseline policy content profile.

It would not authorize:

- a real declaration fact before a concrete Program scope and policy identity are chosen;
- Candidate context/time binding implementation;
- B-07e runtime connection;
- MCFT/Twin forecast integration;
- Approval or Execution authority changes;
- consumer migration;
- historical authority removal.

## Current readiness after policy-content authorization

Even if this profile is authorized, current B-09j still has:

`context_snapshot_ref = null`

and:

`decision_time = null`.

Required canonical readiness would still be:

- QUALIFIED_EVIDENCE: ready shadow-bound;
- CONTEXT: not bound;
- STATE: not bound;
- FORECAST: not product-connected;
- ACTION_WINDOW: not established.

Therefore policy-content authorization is not equivalent to B-07e readiness.

## Next gates after authorization

1. choose one concrete Program scope and stable policy identity;
2. choose an explicit effective window;
3. persist one governed declaration through the existing B-09s authorized writer;
4. establish canonical Candidate ContextSnapshot and decision_time binding;
5. establish canonical support for every required criterion;
6. prove B-09v selects exactly that declaration at the Candidate decision boundary;
7. separately authorize B-07e runtime connection.

## Non-effects

B-09w creates no runtime implementation, route, policy instance, policy fact, graph edge,
B-07e connection, Approval/Execution change, MCFT/ADR/LLM integration, consumer
migration, or authority removal.
