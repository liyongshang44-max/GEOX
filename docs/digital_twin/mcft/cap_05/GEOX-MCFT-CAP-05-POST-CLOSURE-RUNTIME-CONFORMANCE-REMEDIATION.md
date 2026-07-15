<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-POST-CLOSURE-RUNTIME-CONFORMANCE-REMEDIATION.md -->
# MCFT-CAP-05 Post-Closure Runtime Conformance Remediation V1

## 1. Authority identity

- Capability owner: `MCFT-CAP-05`
- Remediation identity: `MCFT-CAP-05.POST-CLOSURE-RUNTIME-CONFORMANCE-REMEDIATION-V1`
- Defect identity: `MCFT-CAP-05-CONFORMANCE-DEFECT-01`
- Successor blocker: `MCFT-CAP-06.S0`
- Historical CAP-05 completion status: `COMPLETE`
- Historical closure records: preserved and not rewritten
- CAP-06 Runtime authority: `false`
- CAP-06 migration authority: `false`

## 2. Confirmed defect

The formal CAP-05 PostgreSQL runner reads a canonical CAP-05 effective feedback Runtime Config whose frozen purpose is:

`HUMAN_DECISION_EXECUTION_FEEDBACK_RUNTIME_V1`

The reused CAP-04 State / Forecast / Scenario execution kernel previously validated that canonical payload directly as a CAP-04 Runtime Config. The CAP-04 validator correctly rejected it with `CAP04_CONFIG_PURPOSE_MISMATCH`.

This is a CAP-05 post-closure Runtime composition defect. It is not a CAP-06 implementation slice and does not grant CAP-06 authority to modify predecessor Runtime semantics.

## 3. Frozen correction

The canonical CAP-05 Config envelope remains untouched and internally self-consistent:

- `object_id` remains derived from the canonical CAP-05 payload;
- `determinism_hash` remains derived from the canonical CAP-05 envelope;
- `payload.config_purpose` remains `HUMAN_DECISION_EXECUTION_FEEDBACK_RUNTIME_V1`;
- `payload.config_selection_mode` remains `PERSISTED_PREDECESSOR_CHAIN_ONLY_V1`;
- `source_refs`, `evidence_refs`, `runtime_config_ref`, and `runtime_config_hash` are not rewritten.

A separate non-canonical execution view is derived:

```ts
type ResolvedCap04ExecutionConfigV1 = {
  source_config_ref: string;
  source_config_hash: string;
  source_config_purpose:
    | "FORECAST_AND_THREE_SCENARIO_CONTINUATION_RUNTIME_V1"
    | "HUMAN_DECISION_EXECUTION_FEEDBACK_RUNTIME_V1";
  payload: Cap04RuntimeConfigPayloadV1;
  resolution_policy_id:
    | "DIRECT_CAP04_RUNTIME_CONFIG_V1"
    | "CAP05_INHERITED_CAP04_EXECUTION_VIEW_V1";
};
```

The execution view:

- is in-memory only;
- is not a `CanonicalObjectEnvelopeV1`;
- has no `object_id`;
- has no `determinism_hash`;
- has no `object_type`;
- has no `idempotency_key`;
- is never persisted or indexed;
- is never an active Config binding;
- is never a second Runtime Config authority.

## 4. Validation separation

The CAP-04 single-tick and pending-Scenario paths are split into two layers:

1. Canonical envelope validation
   - canonical hash recomputation;
   - expected ref/hash pin;
   - object type;
   - scope.
2. Execution payload resolution
   - direct CAP-04 resolution, or
   - validated CAP-05 inherited CAP-04 execution view.

Dynamics, Assimilation, Forecast and Scenario mathematics consume only the resolved `Cap04RuntimeConfigPayloadV1`.

Canonical State, Forecast, Checkpoint and Scenario records continue to persist the canonical source Config ref/hash, never a derived execution-view identity.

## 5. Allowed source boundary

Allowed Runtime changes are restricted to:

- `apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.ts`
- `apps/server/src/runtime/twin_runtime/cap05_inherited_cap04_execution_config_resolver_v1.ts`
- `apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts`
- `apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.ts`
- `apps/server/src/runtime/twin_runtime/receipt_consuming_forecast_scenario_tick_service_v1.ts`
- `apps/server/scripts/mcft/MCFT_CAP_05_HUMAN_DECISION_FEEDBACK_RUNNER.ts`
- dedicated Runtime and governance acceptance files for this remediation.

## 6. Explicit prohibitions

This remediation must not:

- modify an existing canonical CAP-05 Config payload;
- recompute an existing CAP-05 Config object ID as a CAP-04 Config;
- retain a CAP-05 object ID/hash on a CAP-04 payload envelope;
- create a replacement canonical CAP-04 Config;
- persist an execution view;
- relax `validateCap04RuntimeConfigPayloadV1`;
- allow arbitrary Config purposes through CAP-04 validation;
- change Dynamics, Assimilation, Forecast or Scenario mathematics;
- rewrite existing CAP-05 canonical history;
- modify active Config binding;
- create Calibration Candidate, Shadow Evaluation or Model Activation authority;
- create a CAP-06 Runtime source, migration, route, Web path or scheduler.

## 7. Acceptance requirements

The remediation is not effective until all of the following are proven:

### 7.1 Execution-view separation

- canonical CAP-04 and CAP-05 hashes recompute successfully;
- direct CAP-04 path remains valid;
- CAP-05 derivation is deterministic;
- canonical CAP-05 envelope is unchanged;
- execution view has no canonical identity fields;
- stale-hash tampering is rejected;
- wrong CAP-05 purpose is rejected;
- missing inherited CAP-04 field is rejected;
- wrong executable profile is rejected;
- CAP-05 resolver rejects a direct CAP-04 source.

### 7.2 Formal PostgreSQL runner

- predecessor checkpoint `72` is reproducible;
- CAP-05 final checkpoint is `80`;
- eight canonical CAP-05 Runtime Configs exist;
- eight posterior States exist;
- eight completed Forecasts exist;
- eight Scenario Sets exist;
- one canonical Forecast Residual exists;
- State, Forecast and Checkpoint Runtime Config refs/hashes point to canonical CAP-05 Configs;
- restart recovery passes;
- failure before A commit leaves checkpoint unchanged;
- failure between A and B preserves pending-Scenario recovery;
- second completed-chain execution creates zero canonical writes and zero projection divergence.

## 8. Successor eligibility

Until formal PostgreSQL runner regression and merged-main effectiveness are proven:

- `successor_predecessor_eligibility = BLOCKED`
- `cap_06_s0_resume_authorized = false`
- `MCFT-CAP-06.S0 = BLOCKED_BY_PREDECESSOR_RUNTIME_CONFORMANCE`

After merged-main effectiveness, a later append-only status may assert:

- `POST_CLOSURE_RUNTIME_CONFORMANCE_REMEDIATION_EFFECTIVE`
- `FORMAL_POSTGRESQL_TERMINAL_CHAIN_REPRODUCIBLE`
- `CAP_06_PREDECESSOR_ELIGIBILITY_RESTORED`

No such effectiveness claim is authorized by this candidate document alone.
