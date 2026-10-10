# GEOX B-09ad ActionWindow Horizon Value Readiness V1

## Status

Base:

`6787989f509d96ffb0500ad7999955189b5a76c2`

Status:

`ANALYSIS_ONLY_NUMERIC_HORIZON_NOT_READY`

B-09ad asks whether the repository now has enough authority to choose concrete
`start_offset_seconds` and `duration_seconds` for the bounded IRRIGATE path.

The answer is:

`NO`.

## Current numeric state

```
start_offset_seconds = UNDECIDED
duration_seconds     = UNDECIDED
min/max duration     = UNDECIDED
```

No numeric value is selected.

## Why the value is not ready

B-09z ActionWindow semantics are qualified proposals but not authorized.

B-09ab horizon-authority topology is qualified but not authorized.

B-09ac successor policy contract shape is qualified but not authorized.

B-09y canonical decision-boundary semantics are qualified but not implemented/bound.

More importantly, the repository has no explicit product or agronomy declaration that
says how long an IRRIGATE Candidate should remain eligible to proceed toward Approval.

## Things that are not valid numeric evidence

### 72h forecast input

The irrigation calculator consumes 72h weather inputs.

That does not imply:

`duration_seconds = 72h`.

Forecast coverage and Candidate actionability are different semantics.

### FieldProgram daily irrigation constraint

`max_irrigation_mm_per_day` constrains quantity.

It is not a temporal Eligibility horizon.

### allow_night_irrigation

This is an operational/execution-side constraint. It does not define how long the
Candidate remains eligible.

### policy effective_until

This is the lifecycle of the policy declaration itself.

It is not the lifetime of a Candidate selected under that policy.

### EvidenceQualification temporal status

Evidence can be ELIGIBLE or STALE at a decision boundary, but current canonical contracts
do not provide a common future `valid_until` / `expires_at`.

Therefore no deterministic "minimum input expiry" value exists today.

### AO-ACT / Twin / ProblemState windows

These are downstream or different authority domains and cannot be promoted upstream.

### Engineering convenience

Picking 6h, 12h, 24h or any other convenient constant would create hidden product policy.

B-09ad forbids this.

## Forecast dependency

A dynamic forecast-sensitive horizon remains impossible today because canonical Forecast
binding is frozen until MCFT-9 is COMPLETE plus a separate integration authorization.

B-09ad does not use MCFT to unblock the value.

## Current adjudication

`NO_AUTHORIZED_ACTION_SPECIFIC_HORIZON_VALUE_BASIS`

Therefore:

`DO_NOT_SELECT_OR_BACKFILL_NUMERIC_HORIZON`.

The bounded IRRIGATE path cannot currently claim a canonically SATISFIED ACTION_WINDOW.

## Evidence required before choosing a number

A numeric decision requires:

1. accepted ActionWindow semantics/topology;
2. accepted successor policy contract shape;
3. canonical decision_time authority/binding;
4. an explicit product/agronomy authority allowed to declare the IRRIGATE horizon;
5. if dynamic or forecast-sensitive, canonical input-validity semantics and completed
   MCFT Forecast integration;
6. exact immutable provenance for the declaration carrying the value.

## Recommended next governance question

The next useful question is not "6h or 24h?"

It is:

> Which explicit product/agronomy authority is allowed to declare the first IRRIGATE
> start_offset_seconds and duration_seconds values?

B-09ad recommendation:

`DO_NOT_CHOOSE_NUMERIC_VALUE_YET`

This recommendation is not authorization.

## Non-effects

B-09ad changes no runtime, schema, DB, route, graph edge, policy value, numeric horizon,
policy fact, ActionWindow producer, B-07e connection, MCFT implementation or authority
removal.
