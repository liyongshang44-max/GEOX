<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION.md -->
# GEOX MCFT-CAP-05 Authorization and Predecessor Lock

## Authority

```text
authorization_id:
MCFT-CAP-05-AUTHORIZATION-V1

delivery_slice_id:
MCFT-CAP-05.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1

baseline_main_commit:
2d4d00aec8cd1e925687ee67e5de429c324cc1b2

task:
docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md

authorization_status:
READY_FOR_MERGE

authorization_effective:
false

runtime_source_authorized:
false

effectiveness_condition:
S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS
```

## P0 effectiveness

```text
P0 PR: #2432
P0 exact head: 75a270fc2fd044fd57858227b7d1d91b1386cf8a
P0 exact-head workflow: 29305410797 SUCCESS
P0 merge commit: 2d4d00aec8cd1e925687ee67e5de429c324cc1b2
P0 postmerge probe PR: #2434
P0 postmerge workflow: 29305450785 SUCCESS
P0 postmerge Gate: PASS
```

## PostgreSQL predecessor proof

The isolated PostgreSQL canonical read path established:

```text
active_lineage_ref: twin_runtime_lineage_31d5cdda3c87fdf1536f0233
lineage_id: lineage_da76d015085f0d37bf2ed478
revision_id: revision_e0c62f99ac3db66f60a87e2b
latest_posterior_state_ref: twin_state_estimate_8f7d368533a6f5d329374071
latest_checkpoint_ref: twin_runtime_checkpoint_8bea285af4eba78d58c9ad5c
latest_forecast_result_ref: twin_forecast_run_f39699032a45814603caddf5
latest_successful_forecast_ref: twin_forecast_run_f39699032a45814603caddf5
latest_scenario_set_ref: twin_scenario_set_f382a595734b3262b5bc6fd9
predecessor_state_runtime_config_ref: twin_runtime_config_cb77e26dd8db7eb32c3518cb
reality_binding_ref: mcft_rb_bf1da664164a4fedda249bcb
checkpoint_sequence: 72
latest_logical_time: 2026-06-04T01:00:00.000Z
next_tick_logical_time: 2026-06-04T02:00:00.000Z
```

All hashes and cross-reference relations are frozen in docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PREDECESSOR-LOCK.json. Replay Runtime Config authority is the exact State-bound Runtime Config ref/hash, not an active-config pointer.

## Delivery authority

Before S0 merge and merged-main Authorization Gate:

```text
design_status: DESIGN_FROZEN_CANDIDATE_V0_4
implementation_status: NOT_AUTHORIZED
runtime_source_authorized: false
active_delivery_slice_id: MCFT-CAP-05.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1
next_authorized_slice_ids: []
```

After S0 merge and merged-main Authorization Gate, only this slice becomes eligible for explicit activation:

```text
MCFT-CAP-05.MCFT-01-13-15.CONTROLLED-FEEDBACK-REPLAY-DATASET-V1
```

## Exact changed-file boundary

- `docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md`
- `docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json`
- `docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json`
- `docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION.md`
- `docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json`
- `docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PREDECESSOR-LOCK.json`
- `docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S0-ALIGNMENT-REVIEW.md`
- `docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md`
- `scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_AUTHORIZATION.cjs`
- `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PREDECESSOR_PREFLIGHT.ts`

No Runtime source, migration, canonical Decision/Feedback/Residual write, route, web, AO-ACT, scheduler, or CAP-06 authorization is included.

## Preserved nonclaims

```text
NO_MCFT_CAP_05_RUNTIME_SOURCE_AUTHORIZATION
NO_CONTROLLED_REPLAY_DATASET_CREATED_BY_S0
NO_HUMAN_DECISION_CANONICAL_WRITE
NO_APPROVAL_ASSERTION_EVIDENCE_WRITE
NO_APPROVED_PLAN_EVIDENCE_WRITE
NO_ACTION_FEEDBACK_CANONICAL_WRITE
NO_FORECAST_RESIDUAL_CANONICAL_WRITE
NO_RECEIPT_CONSUMING_STATE_TICK
NO_MIGRATION
NO_ROUTE
NO_WEB
NO_AO_ACT_CHANGE
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_CALIBRATION_CANDIDATE
NO_MODEL_ACTIVATION
NO_CONTINUOUS_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_CAP_06_AUTHORIZATION
NO_MCFT_GATE_A_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```
