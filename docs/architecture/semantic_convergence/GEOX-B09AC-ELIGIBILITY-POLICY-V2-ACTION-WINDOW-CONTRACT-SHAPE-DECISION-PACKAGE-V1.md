# GEOX B-09ac Eligibility Policy V2 ActionWindow Contract Shape Decision Package V1

## Status

Base:

`88ed1f6139f12b2ca61d1c494d2ec979b1f96500`

Decision:

`DEC-BLINE-ELIGIBILITY-POLICY-V2-ACTION-WINDOW-CONTRACT-001`

Status:

`RECOMMENDED_NOT_AUTHORIZED`

B-09ac proposes only the field semantics for a future successor Eligibility policy
contract. It does not implement the contract and does not select any concrete ActionWindow
duration.

## Proposed successor

Nominal successor:

`DecisionEligibilityPolicyDeclarationV2`

Existing:

`DecisionEligibilityPolicyDeclarationV1`

remains immutable predecessor semantics.

The proposed new field is:

`action_window_policy`

It is nullable at the policy level, but must be present exactly when
`required_criteria` contains `ACTION_WINDOW`.

## Proposed field shape

The recommended v1 policy-only shape is conceptually:

```
action_window_policy:
  authority_state: ELIGIBILITY_ACTIONABILITY_HORIZON_ONLY
  anchor: CANDIDATE_DECISION_TIME
  start_offset_seconds: explicit nonnegative safe integer
  duration_seconds: explicit positive safe integer
  interval_semantics: HALF_OPEN_[START_END)
  derivation_mode: POLICY_ONLY_V1
```

No field has a hidden default.

## Deterministic materialization

Given canonical Candidate decision_time:

`window_start = decision_time + start_offset_seconds`

`window_end = window_start + duration_seconds`

The resulting Candidate-specific ActionWindow is half-open:

`[window_start, window_end)`

Missing decision_time, missing required policy content, invalid arithmetic or overflow must
fail closed.

A pure materializer must not use Date.now(), request arrival time or evaluator wall clock
to construct the original ActionWindow.

## Why relative seconds

The repository currently has no established reusable duration representation.

B-09ac recommends explicit integer seconds because:

- the unit is encoded in the field name;
- arithmetic is deterministic;
- it is language/database agnostic;
- it avoids ISO-8601 calendar-duration ambiguity;
- reusable policy content should not contain absolute Candidate timestamps.

Milliseconds are not recommended for this policy layer.

ISO-8601 duration strings are not recommended for v1.

Absolute window_start/window_end in the reusable policy declaration are forbidden.

## Criterion coupling

If `required_criteria` contains `ACTION_WINDOW`:

`action_window_policy != null`

is required.

If `required_criteria` does not contain `ACTION_WINDOW`:

`action_window_policy == null`

is required.

This prevents a policy from carrying hidden ActionWindow authority that does not
participate in Eligibility.

## NOT_YET_ACTIVE support

A zero start offset would permit actionability beginning at canonical decision_time.

A positive start offset would support an explicit NOT_YET_ACTIVE period.

These are examples of the schema's expressive power only.

B-09ac selects neither value.

## Concrete values remain undecided

B-09ac does not select:

- start_offset_seconds;
- duration_seconds;
- minimum duration;
- maximum duration;
- an IRRIGATE-specific duration;
- dynamic agronomic shortening;
- Forecast-dependent shortening.

No 6h/12h/24h/72h policy value is created.

## Versioning

Existing v1 declarations remain valid under v1 semantics.

They are not reinterpreted as v2 and receive no default/backfilled ActionWindow horizon.

A real v2 declaration must have explicit v2 identity/versioning.

Selector compatibility and writer/route compatibility are separate implementation gates.

## Relationship to MCFT

The proposed `POLICY_ONLY_V1` horizon does not depend on Forecast or MCFT.

Forecast-dependent dynamic shortening remains frozen until MCFT-9 is complete and a
separate integration authorization exists.

## Authorization effect

Accepting this decision would authorize only the successor field semantics and later
contract implementation under B02 governance.

It would not authorize a concrete duration, real policy declaration, writer/route change,
selector compatibility change, ActionWindow producer, B-07e connection, MCFT integration,
Approval/Execution mutation, consumer migration or authority removal.

## Non-effects

B-09ac changes no runtime, schema, DB, route, graph edge, existing v1 contract, policy
fact, ActionWindow producer, B-07e connection, MCFT implementation or historical
authority.
