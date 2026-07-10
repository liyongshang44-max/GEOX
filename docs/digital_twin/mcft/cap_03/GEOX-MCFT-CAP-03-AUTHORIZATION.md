<!-- docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-AUTHORIZATION.md -->
# GEOX MCFT-CAP-03 Authorization and Predecessor Lock

## Authority

```text
authorization_id:
MCFT-CAP-03-AUTHORIZATION-V1

delivery_slice_id:
MCFT-CAP-03.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1

baseline_main_commit:
d1a3948d06e4c7896d513168d31ef52409c3e0f0

task:
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TASK.md

authorization_status:
READY_FOR_MERGE

authorization_effective:
false

runtime_source_authorized:
false

effectiveness_condition:
S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS
```

## Predecessor proof

MCFT-CAP-02 is COMPLETE on the baseline main commit. The isolated PostgreSQL canonical read path established:

```text
active_lineage_ref:
twin_runtime_lineage_31d5cdda3c87fdf1536f0233

lineage_id:
lineage_da76d015085f0d37bf2ed478

revision_id:
revision_e0c62f99ac3db66f60a87e2b

latest_state_ref:
twin_state_estimate_f4691584346d497c87045440

latest_checkpoint_ref:
twin_runtime_checkpoint_f3c931e60a3ce35c23483c44

latest_forecast_result_ref:
twin_forecast_run_6ad12f4bb79a15f897c7236d

latest_successful_forecast_ref:
null

runtime_config_ref:
twin_runtime_config_e31f91abc83b42eaad23d5d3

checkpoint.tick_sequence:
24

checkpoint.next_tick_logical_time:
2026-06-02T02:00:00.000Z
```

The historical successor start-time metadata is corrected only through the additive erratum. CAP-02 historical artifacts and canonical facts remain immutable.

## Delivery authority

Every edge is merge-before-next and postmerge-verify-before-next. Before S0 merge and the merged-main Authorization Gate:

```text
design_status:
FINAL_FROZEN_CANDIDATE_V1_2

implementation_status:
NOT_AUTHORIZED

active_delivery_slice_id:
MCFT-CAP-03.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1

next_authorized_slice_ids:
[]

MCFT-CAP-04:
NOT_AUTHORIZED
```

After S0 merge and the merged-main Authorization Gate, only this slice becomes eligible for explicit activation:

```text
MCFT-CAP-03.MCFT-02-07-08.ASSIMILATION-CONTRACTS-CONFIG-V1
```

## Exact changed-file boundary

- `docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md`
- `docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-02-HANDOFF-ERRATUM-01.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-AUTHORIZATION-STATUS.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-AUTHORIZATION.md`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-PREDECESSOR-LOCK.json`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S0-ALIGNMENT-REVIEW.md`
- `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TASK.md`
- `scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_AUTHORIZATION.cjs`
- `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_PREDECESSOR_PREFLIGHT.cjs`

No Runtime, domain, persistence transaction, adapter, projection schema, migration, route, web, scheduler, assimilation implementation, CAP-03 tick, or CAP-04 authorization is included.

## Preserved nonclaims

```text
NO_MCFT_CAP_03_RUNTIME_AUTHORIZATION
NO_MCFT_CAP_03_COMPLETE_CLAIM
NO_OBSERVATION_UPDATE_APPLIED
NO_OBSERVATION_INNOVATION_COMPUTED
NO_FORECAST_RESIDUAL
NO_SUCCESSFUL_FORECAST
NO_72_HOUR_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_DECISION
NO_AO_ACT
NO_CALIBRATION_CANDIDATE
NO_SHADOW_EVALUATION
NO_MODEL_ACTIVATION
NO_ACTIVE_MODEL_PARAMETER_CHANGE
NO_CALIBRATED_CONFIDENCE_MODEL
NO_MULTI_SENSOR_FUSION
NO_DYNAMIC_ROOT_ZONE_GEOMETRY
NO_LATE_EVIDENCE_REVISION
NO_AUTOMATIC_RECOMPUTE_ON_LATE_EVIDENCE
NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_720_TICK_REPLAY_CLOSURE
NO_LIVE_FIELD_CLAIM
NO_FIELD_VALIDATED_OBSERVATION_OPERATOR
NO_FIELD_CALIBRATED_ASSIMILATION_NOISE_MODEL
NO_MCFT_GATE_A_CLOSURE
NO_MCFT_GATE_B_CLOSURE
NO_MCFT_GATE_C_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```
