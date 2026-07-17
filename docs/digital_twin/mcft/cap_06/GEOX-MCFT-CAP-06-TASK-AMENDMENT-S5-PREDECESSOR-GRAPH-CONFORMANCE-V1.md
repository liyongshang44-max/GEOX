# MCFT-CAP-06 Task Amendment — S5 Predecessor Graph and Dual-Time Conformance V1

## Decision

The S5 implementation transition is amended from:

```text
S5-entry merged-effective -> S5
```

to:

```text
S5-entry merged-effective
-> S5 predecessor graph and dual-time conformance
-> S5
```

Inserted prerequisite:

```text
MCFT-CAP-06.S5-PREDECESSOR.GRAPH-AND-DUAL-TIME-CONFORMANCE-V1
```

S5 remains blocked until this prerequisite is merged-main effective.

## Confirmed predecessor defects

The effective S1 controlled numerical profile remains valid, but its object graph is insufficient for the exact S5 authority path:

1. controlled Assimilation objects do not expose a forward `posterior_state_ref`;
2. the S5 authority graph V1 conflates Observation event time with Runtime availability time;
3. controlled Forecast roots use direct CAP-04 Runtime Configs while post-closure CAP-05 roots use CAP-05 inherited execution Configs.

These are graph-composition and dual-time defects. They do not authorize changes to calibration mathematics, canonical identity rules, A0 contracts, CAP-04 validators, or CAP-05 historical closure.

## Append-only treatment

The effective S1 V1 profile and its hashes remain immutable historical evidence.

A graph-conformant V2 controlled profile is added with:

```text
Residual
-> Forecast
-> Forecast Config
-> source posterior
-> Forecast Evidence Window

Residual
-> Residual Config
-> Assimilation
-> observation posterior
-> Observation Evidence Window
-> selected Observation
```

Every edge is forward and exact. The V2 objects preserve the original numerical cases as source lineage while adding observation posterior and availability-time graph authority.

## Dual-time correction

The corrected graph separates:

- `observed_at`: event time and Forecast target time;
- `available_to_runtime_at`: first Runtime-visible time.

Required invariants:

```text
forecast_evidence_window.as_of <= forecast.as_of
forecast.as_of < available_to_runtime_at
forecast.issued_at < available_to_runtime_at
observed_at <= available_to_runtime_at
observation_evidence_window.as_of == available_to_runtime_at
assimilation.logical_time == available_to_runtime_at
observation_posterior.logical_time == available_to_runtime_at
```

The original authority graph V1 is not rewritten. The corrected machine authority is:

```text
docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-PREDECESSOR-AUTHORITY-GRAPH-V2.json
```

## Execution-config resolution

One deterministic resolver dispatches by the frozen `config_purpose` discriminator:

- direct CAP-04 Runtime Config -> direct CAP-04 execution view;
- CAP-05 effective Runtime Config -> positive CAP-04 inherited execution projection.

Fallback-by-exception is forbidden.

## PostgreSQL authority

`PostgresResolvedForecastObservationCaseAssemblerV1` remains the sole graph authority. It is extended, not replaced, to expose complete resolved cases and exact ordered Residual-root resolution under one `REPEATABLE READ READ ONLY` transaction.

Forbidden surfaces remain:

```text
LATEST
TIME_RANGE_SEARCH
SCOPE_RANGE_SEARCH
RAW_OBSERVATION_SIDE_LOOKUP
ALTERNATIVE_GRAPH_TRAVERSAL
```

## Required local preflight

Before a prerequisite candidate head is pushed, one clean head must pass:

```text
node scripts/runtime_acceptance/RUN_MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE.cjs
```

Required stages:

```text
TYPECHECK
BUILD
S1_NUMERICAL_BASELINE_REGRESSION
V2_DOMAIN_GRAPH_CONFORMANCE
V2_POSTGRESQL_EXACT_REF_CONFORMANCE
S2_EXACT_MATH_COMPATIBILITY
S3_PERSISTENCE_REGRESSION
S4_DOMAIN_AND_FORMAL_COMPOSITION
S5_ENTRY_EFFECTIVENESS_REGRESSION
STRUCTURED_GOVERNANCE_GATE
```

## Protected predecessor contracts

This prerequisite may not modify:

```text
apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.ts
apps/server/src/domain/twin_runtime/canonical_identity_v1.ts
apps/server/src/domain/twin_runtime/forecast_canonical_authority_v1.ts
apps/server/src/runtime/twin_runtime/a0_record_set_builder_v1.ts
```

## Nonclaims

```text
NO_S5_IMPLEMENTATION
NO_CANDIDATE_APPEND
NO_SHADOW_EVALUATION_APPEND
NO_MODEL_ACTIVATION
NO_ACTIVE_CONFIG_SWITCH
NO_RUNTIME_PARAMETER_CHANGE
NO_STATE_OR_CHECKPOINT_MUTATION
NO_MIGRATION
NO_PUBLIC_ROUTE
NO_WEB
NO_SCHEDULER
NO_MCFT_CAP_07_AUTHORIZATION
```
