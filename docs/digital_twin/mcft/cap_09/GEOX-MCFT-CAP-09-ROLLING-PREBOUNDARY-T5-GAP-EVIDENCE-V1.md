# GEOX MCFT-CAP-09 — Rolling Pre-boundary T-5 Implementation Gap Evidence V1

Status: **DIAGNOSTIC / IMPLEMENTATION-ADJUDICATION ONLY**

Capability: `MCFT-CAP-09.S6`

Authority: `PROVIDER_AVAILABILITY_WATERMARK_V1`

## 1. Decisive finding

The current rolling pre-boundary implementation inherits a historical `T-5m` ingestion-margin cutoff from the Amendment-07 fixed-lag readiness runner.

That cutoff is not the Amendment-11 rolling qualification authority.

Amendment-11 requires the three pre-boundary causal families to satisfy:

```text
available_to_runtime_at <= T
ingested_at <= T
```

and requires the rolling soil/GFS package to be actually acquired and frozen before target `T`.

The soil observation-time identity remains unchanged:

```text
observed_at in [T-15m, T]
```

No event-time relabeling, source substitution, interpolation, persistence fill, or post-T future-forcing acquisition is authorized.

## 2. Protected-main rolling failure

Protected-main subject:

```text
37a36ba52d7ef7891d72cc1385314ec453511296
```

Workflow run:

```text
31698205161
```

Target:

```text
2026-08-13T13:00:00.000Z
```

Substantive failure:

```text
EA5E2_PREBOUNDARY_SOIL_OBSERVATION_NOT_IN_AUTHORIZED_T_WINDOW
```

The runner began soil polling at `T-15m` but stopped before `T-5m` because it used the historical five-minute readiness margin as the polling deadline.

The failure cleanup succeeded and removed all tracked transient qualification objects. The run produced no Formal DB write, no Formal raw-prefix write, no scheduler write, no Runtime write, and no Formal activation.

## 3. Independent endpoint-25 publication evidence

Diagnostic run:

```text
31610093739
```

Job:

```text
94158919620
```

Artifact:

```text
9149626292
```

Artifact digest:

```text
sha256:827f12977400afc43741254eaf7105e0cd63e2199c11d459690e8afa59428054
```

The diagnostic recorded metadata-only exact source-row first-seen timing and no soil values.

Observed exact-hour phase evidence included:

```text
:45 / T-15 row: first-seen lag upper bound about 5.59m
:50 / T-10 row: first-seen lag upper bound about 10.789m
:55 / T-5 rows: first-seen lag upper bounds about 10.416m and 10.817m
```

The diagnostic therefore proves that provider publication/visibility latency can place a valid source row inside the Amendment-11 causal boundary while making it unavailable before the historical T-5 operational cutoff.

This is provider timing evidence, not authority to relax the observation-time window.

## 4. Implementation adjudication

The correct additive implementation model is:

```text
historical/non-rolling caller
  -> retain HISTORICAL_T_MINUS_5_MARGIN behavior

Amendment-11 rolling qualification caller
  -> deadline authority = PROVIDER_AVAILABILITY_WATERMARK_V1
  -> poll/collect only until target T
  -> require observed_at in [T-15m,T]
  -> require available_to_runtime_at <= T
  -> require ingested_at <= T
  -> fail closed if collection/canonicalization/ingress crosses T
```

This is an implementation correction. It is not a new temporal authority and does not weaken causality.

## 5. Current live continuation

A second protected-main scheduled rolling run was registered as:

```text
31705733712
```

Its planner step executed at `2026-08-13T13:36:52Z`. Under the deterministic `ceil(now + 35m)` planner, its target is:

```text
2026-08-13T15:00:00.000Z
```

This run still executes the pre-correction protected-main implementation and is therefore diagnostic evidence only until its final result is known.

## 6. Nonclaims

This evidence does not:

- change Amendment-11;
- authorize soil observation outside `[T-15m,T]`;
- authorize post-T acquisition;
- change crop authority;
- start Formal O00;
- qualify EA5E2 operational activation;
- authorize source substitution;
- authorize time relabeling;
- claim that any particular future rolling attempt will pass.
