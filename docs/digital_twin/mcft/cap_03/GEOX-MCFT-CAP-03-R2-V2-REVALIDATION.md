# GEOX MCFT-CAP-03 R2 V2 Revalidation Boundary Freeze

## 1. Authority

R1 is effective on main commit `6ef413b7afe6c8bb9997c035aa18cf8bca0f394d`.

R2 boundary freeze is authorized. R2 Runtime implementation remains unauthorized until this boundary-freeze candidate is merged, reproduced on synchronized main, and closed by the dedicated boundary-effectiveness transition.

## 2. Objective

R2 revalidates S3A through S6 against the additive V2 observation semantics established by R1 and reconciles machine-readable SSOT only when new V2 evidence exists.

R2 does not reinterpret or rewrite historical V1 facts.

## 3. Affected slices

- `MCFT-CAP-03.MCFT-02-07-08.ASSIMILATED-A2-RECORD-SET-BUILDER-V1`
- `MCFT-CAP-03.MCFT-03-08.ASSIMILATED-A2-PERSISTENCE-RECOVERY-V1`
- `MCFT-CAP-03.MCFT-04-05-06-07-08-09.SINGLE-TICK-INTEGRATION-V1`
- `MCFT-CAP-03.MCFT-04-07-08.TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-V1`
- `MCFT-CAP-03.MCFT-03-04-07-08.RESTART-BACKFILL-RECOVERY-V1`

## 4. Frozen strategy

- Historical V1 contracts, validators, facts, and readback remain valid and immutable.
- V2 receives an additive Runtime Config, eight-object A2 record set, identity, validators, builder, single-tick service, range service, and restart/backfill service.
- Versioned dispatch must accept CAP-02 V1, CAP-03 V1, and CAP-03 V2 by explicit discriminator and fail closed on unknown or mismatched combinations.
- PostgreSQL reuses the existing A2 transaction, idempotency index, canonical facts, and five projections with zero migration.
- V1 and V2 writes for the same continuation operation key are forbidden; an existing canonical record set wins and incompatible content fails closed.
- S6 effectiveness remains paused. R3 alone may resume it after R2 becomes effective.

## 5. Existing V2 prerequisites reused without modification

- `apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.ts`
- `apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.ts`
- `apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts`

## 6. Frozen activation boundary

- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R2-V2-REVALIDATION-STATUS.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R2-V2-REVALIDATION.md`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S2-SEMANTIC-CONFORMANCE-REMEDIATION-STATUS.json`
- `scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION_ACTIVATION.cjs`

## 7. Frozen implementation boundary

- `apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.ts`
- `apps/server/src/domain/twin_runtime/assimilated_continuation_cross_ref_validator_v2.ts`
- `apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_identity_v2.ts`
- `apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_validator_v2.ts`
- `apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v2.ts`
- `apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.ts`
- `apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.ts`
- `apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts`
- `apps/server/src/runtime/twin_runtime/assimilated_contiguous_range_service_v2.ts`
- `apps/server/src/runtime/twin_runtime/assimilated_continuation_record_set_builder_v2.ts`
- `apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_authority_adapter_v2.ts`
- `apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_service_v2.ts`
- `apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v2.ts`
- `apps/server/src/runtime/twin_runtime/assimilated_restart_resume_service_v2.ts`
- `apps/server/src/runtime/twin_runtime/ports.ts`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATED-PERSISTENCE-RECOVERY-STATUS.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATED-RECORD-SET-BUILDER-STATUS.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-OBSERVATION-ASSIMILATION-STATUS.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R2-V2-REVALIDATION-STATUS.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R2-V2-REVALIDATION.md`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-RESTART-BACKFILL-RECOVERY-STATUS.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S2-SEMANTIC-CONFORMANCE-REMEDIATION-STATUS.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-SINGLE-TICK-INTEGRATION-STATUS.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-STATUS.json`
- `scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION.cjs`
- `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION.ts`
- `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION_DB.ts`
- `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION_NEGATIVE.ts`
- `scripts/runtime_acceptance/mcft_cap_03_r2_v2_revalidation_fixture_v1.ts`

## 8. Required evidence

- V2 Runtime Config positive and negative validation.
- V2 builder and full eight-object cross-reference validation.
- CAP-02 V1 / CAP-03 V1 / CAP-03 V2 dispatch.
- V2 PostgreSQL idempotency, readback, projection rebuild, failure rollback, and zero migration.
- One V2 tick.
- Twenty-four contiguous V2 ticks.
- V2 restart and bounded forward backfill hash equivalence.
- Historical V1 positive and negative acceptance without semantic reinterpretation.
- S3A through S6 machine status reconciliation backed by the new V2 evidence.
- Typecheck, build, exact-head CI, and merged-main Gate.

## 9. Excluded debt

`MCFT-CAP-03.GOV-DEBT-001` is recorded as GitHub issue #2351. It concerns P1 smoke report-projection polling and must be remediated in a separate PR. It is not part of R2 semantics or the R2 changed-file boundary.

## 10. Preserved nonclaims

- `NO_R2_RUNTIME_SOURCE_CHANGE_IN_BOUNDARY_FREEZE`
- `NO_V1_CANONICAL_FACT_REWRITE`
- `NO_V1_VALIDATOR_SEMANTIC_REINTERPRETATION`
- `NO_SAME_OPERATION_KEY_DUAL_WRITE`
- `NO_SCHEMA_MIGRATION`
- `NO_NEW_TRANSACTION_FAMILY`
- `NO_NEW_PROJECTION`
- `NO_SUCCESSFUL_FORECAST`
- `NO_72_HOUR_FORECAST`
- `NO_SCENARIO`
- `NO_RECOMMENDATION`
- `NO_POLICY_EVALUATION`
- `NO_DECISION`
- `NO_AO_ACT`
- `NO_CALIBRATION_CANDIDATE`
- `NO_SHADOW_EVALUATION`
- `NO_MODEL_ACTIVATION`
- `NO_ACTIVE_MODEL_PARAMETER_CHANGE`
- `NO_LATE_EVIDENCE_REVISION`
- `NO_CONTINUOUS_RUNTIME`
- `NO_LIVE_FIELD_CLAIM`
- `NO_S6_EFFECTIVENESS_RESUME`
- `NO_S7_ACTIVATION`
- `NO_S8_ACTIVATION`
- `NO_MCFT_CAP_04_AUTHORIZATION`
- `NO_MCFT_CAP_03_COMPLETE_CLAIM`
- `NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM`

<!-- R2_V2_CANDIDATE_VALIDATION_EVIDENCE_V1 -->
## R2 implementation candidate validation evidence

This section records local source-candidate evidence only. It does not make R2 effective, resume S6 effectiveness, authorize R3, activate S7 or S8, authorize MCFT-CAP-04, or claim MCFT-CAP-03 completion.

```text
implementation baseline: 0a70d74849942d2f50e39578767212d91caa0a42
implementation branch: mcft-cap-03-s2-semantic-conformance-r2-v2-revalidation-v1
implementation state: CANDIDATE_VALIDATED_NOT_EFFECTIVE
positive in-memory: PASS_9_OF_9
negative semantic: PASS_6_OF_6
isolated PostgreSQL: PASS_15_OF_15
versioned dispatch: PASS_CAP_02_V1_CAP_03_V1_CAP_03_V2
historical CAP-03 V1 dispatch: PASS
same-operation-key V1/V2 dual-write guard: PASS_FAIL_CLOSED
single V2 tick: PASS
24 contiguous V2 ticks: PASS
restart terminal hash equivalence: PASS
bounded forward backfill terminal hash equivalence: PASS
late-evidence revision: PASS_FAIL_CLOSED
zero schema migration: PASS
server typecheck: PASS
server build: PASS
git diff check: PASS
exact-head CI: PENDING
merged-main postmerge gate: PENDING
```

Historical V1 canonical facts, contracts, validators, readback, merge records, and prior evidence remain immutable. R2 introduces additive V2 evidence only.
