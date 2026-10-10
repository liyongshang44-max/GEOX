# GEOX B-09aa ActionWindow Horizon Authority Inventory V1

## Status

`ANALYSIS_ONLY_NO_HORIZON_AUTHORITY_SELECTED`

Base:

`4ab816a5cd612392b8d47e8849754d017418beca`

B-09aa does not select or create a horizon authority. It inventories the repository and
proves that no current time-window/horizon semantic may be silently promoted into
Decision Eligibility ACTION_WINDOW authority.

## Current result

Current authorized ActionWindow horizon source:

`NONE`.

## Rejected existing sources

### Irrigation 72h forecast inputs

`rain_forecast_mm_72h` and `et0_mm_72h` are calculation inputs.

They describe the horizon of forecast information consumed by the irrigation requirement
calculator. They do not say that the resulting Candidate remains actionable for 72 hours.

Therefore:

`72h forecast horizon != 72h ActionWindow`.

### FieldProgram

FieldProgram contains constraints such as max irrigation per day, night-irrigation
permission and downstream execution/approval policy.

It contains no canonical Candidate actionability duration.

### Eligibility policy effective window

`effective_from/effective_until` answers whether a policy itself is applicable at the
Candidate decision boundary.

It does not define how long one Candidate remains eligible after that boundary.

### Canonical EvidenceQualification

EvidenceQualification contains temporal eligibility such as ELIGIBLE / STALE /
FUTURE_RELATIVE_TO_DECISION / NOT_AVAILABLE_AT_DECISION.

It has no canonical `valid_until` or `expires_at` authority.

Therefore B-Line cannot currently compute ActionWindow end as "minimum input expiry".

### Canonical Context / Calculation / Candidate

These contracts carry decision_time/evaluated_at anchors, but no common future validity
horizon.

A timestamp is not a duration policy.

### ProblemState window

ProblemState window governs problem/evidence lifecycle and reuse. It is not Candidate
Eligibility actionability authority.

### Twin P35 / P44

P35 governs Twin candidate-pointer calibration/review use.

P44 governs model activation/canary lifecycle.

Neither owns B-Line Decision Eligibility.

### AO-ACT P47

P47 governs a downstream authorization/task time window.

Eligibility must precede Approval and AO-ACT. A downstream task window cannot be reused
to decide whether the upstream Candidate was eligible.

### MCFT/Twin scientific/runtime windows

These describe forecast, evidence, Formal, scheduler and runtime behavior.

MCFT-9 is incomplete and remains a frozen external dependency for B-Line Forecast.
These windows are not ActionWindow authority.

## Forbidden derivations

B-09aa rejects:

- ActionWindow = 72 hours because forecast input horizon is 72h;
- ActionWindow end = policy effective_until;
- ActionWindow = minimum input valid_until, because no common canonical valid_until exists;
- ActionWindow = a hardcoded 6h/12h/24h default;
- ActionWindow = downstream AO-ACT task window.

## Future authority options

### Option A — explicit eligibility horizon policy

A separately governed actionability-horizon policy/ref provides the finite horizon.

This is the simplest v1 authority model.

### Option B — dynamic agronomic actionability calculation

A canonical calculation derives a candidate-specific horizon from authorized inputs,
subject to explicit policy bounds.

This is more adaptive but requires stronger input-validity semantics and, for forecast-
dependent behavior, cannot currently depend on incomplete MCFT-9.

### Option C — policy cap plus dynamic input validity

The final window is bounded by both product-policy maximum duration and canonical input
validity horizons.

This is not currently implementable because the repository lacks a common canonical
valid_until contract.

## Recommended next governance question

B-09aa recommends asking:

> Should ActionWindow v1 use explicit policy-only horizon authority, or permit dynamic
> agronomic derivation under an explicit policy cap?

The recommendation for v1 is:

`START_WITH_EXPLICIT_POLICY_ONLY_V1`

because this keeps authority auditable, avoids inventing input TTL semantics, and avoids
premature MCFT dependency.

This recommendation is not authorization.

## Non-effects

B-09aa changes no runtime, schema, DB, route, graph edge, policy content, horizon source,
ActionWindow producer, B-07e connection, MCFT implementation, migration or historical
authority.
