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

The CAP-04 single-tick, source-builder, record-set-builder and pending-Scenario paths are split into two layers:

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

## 5. Replay execution metadata compatibility

The controlled Replay source-binding matrix freezes a positive integer `binding_version`. Some older binding conversion rules omit the duplicated textual `conversion_rule.version` required by the CAP-03 observation selectors.

The file-source adapter must preserve the canonical binding conversion rule exactly as recorded and attach a separate non-canonical execution metadata object:

```ts
execution_metadata: {
  policy_id: "SOURCE_BINDING_CONVERSION_RULE_VERSION_FROM_BINDING_VERSION_V1";
  source_binding_version: number;
  conversion_rule_version: string;
}
```

The execution version is `String(binding_version)`. If the canonical conversion rule already contains an explicit version, it must equal that value or loading fails closed.

This compatibility projection:

- occurs after source-record semantic-hash verification;
- does not mutate Replay Evidence bytes or `source_record_hash`;
- does not rewrite canonical `conversion_rule`;
- does not modify the source-binding matrix;
- is stripped before A0 canonical Evidence persistence and semantic hashing;
- cannot change the A0 Evidence digest, active-lineage object ID, or predecessor lock;
- is consumed only by observation-selection execution logic;
- does not create a canonical object or new authority.

## 6. Allowed source boundary

Allowed Runtime, adapter and acceptance changes are restricted to:

- `apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.ts`
- `apps/server/src/runtime/twin_runtime/cap05_inherited_cap04_execution_config_resolver_v1.ts`
- `apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts`
- `apps/server/src/runtime/twin_runtime/forecast_scenario_state_source_builder_v1.ts`
- `apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.ts`
- `apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.ts`
- `apps/server/src/runtime/twin_runtime/receipt_consuming_forecast_scenario_tick_service_v1.ts`
- `apps/server/src/runtime/twin_runtime/ports.ts`
- `apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.ts`
- `apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.ts`
- `apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v1.ts`
- `apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts`
- `apps/server/scripts/mcft/MCFT_CAP_05_HUMAN_DECISION_FEEDBACK_RUNNER.ts`
- dedicated Runtime and governance acceptance files for this remediation.

## 7. Explicit prohibitions

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
- mutate frozen Replay Evidence identity, canonical conversion data, A0 Evidence semantics, active-lineage identity, or source-binding authority;
- create Calibration Candidate, Shadow Evaluation or Model Activation authority;
- create a CAP-06 Runtime source, migration, route, Web path or scheduler.

## 8. Acceptance requirements and candidate proof

### 8.1 Execution-view separation

The permanent acceptance proves:

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

Candidate result: `10 PASS / 0 FAIL`.

### 8.2 Replay binding execution metadata

The permanent acceptance proves:

- the execution-metadata policy identity is frozen;
- an absent conversion-rule version is attached only as separate execution metadata derived from frozen `binding_version`;
- Replay Evidence hash and file bytes remain unchanged;
- canonical A0 Evidence and active-lineage identity inputs are identical with or without execution metadata;
- the CAP-03 observation selector resolves the executable conversion version from separate metadata;
- a matching explicit conversion-rule version remains valid and consistent;
- an explicit version conflict fails closed;
- a missing binding version fails closed.

Candidate result: `8 PASS / 0 FAIL`.

### 8.3 Cross-capability regression

The same proof workflow executes the complete CAP-03 inherited persistence/recovery regression from the canonical frozen predecessor handoff. It passes without `ACTIVE_LINEAGE_OBJECT_REF_MISMATCH`, proving that Replay execution metadata does not alter the A0 active-lineage identity.

### 8.4 Formal PostgreSQL runner

Candidate workflow `29438990685` at committed source `8b386850b0370f27d1756ab10571eec452933ad6` proves:

- predecessor checkpoint `72` is reproducible;
- first CAP-05 committed sequence is `73`;
- CAP-05 final checkpoint is `80`;
- final next logical tick is `2026-06-04T10:00:00.000Z`;
- eight canonical CAP-05 Runtime Configs exist;
- eight posterior States exist;
- eight completed Forecasts exist;
- eight Scenario Sets exist;
- `576` Forecast points exist;
- `1728` Scenario points exist;
- one canonical Forecast Residual exists;
- State, Forecast and Checkpoint Runtime Config refs/hashes point to canonical CAP-05 Configs;
- restart recovery passes;
- failure before A commit leaves checkpoint unchanged;
- failure between A and B preserves pending-Scenario recovery;
- second completed-chain execution creates zero canonical writes and zero projection divergence.

The proof makes no causal-effect, Forecast/Assimilation equivalence, automatic-history-rewrite, field-calibration, or continuous-online Runtime claim.

## 9. Successor eligibility

The candidate branch has proven the remediation, but merged-main effectiveness has not yet been established. Therefore:

- `successor_predecessor_eligibility = BLOCKED`
- `cap_06_s0_resume_authorized = false`
- `MCFT-CAP-06.S0 = BLOCKED_AWAITING_REMEDIATION_MERGED_MAIN_EFFECTIVENESS`

After merge and a merged-main PostgreSQL proof, a later append-only status may assert:

- `POST_CLOSURE_RUNTIME_CONFORMANCE_REMEDIATION_EFFECTIVE`
- `FORMAL_POSTGRESQL_TERMINAL_CHAIN_REPRODUCIBLE`
- `CAP_06_PREDECESSOR_ELIGIBILITY_RESTORED`

No such effectiveness claim is authorized by this candidate document alone.
