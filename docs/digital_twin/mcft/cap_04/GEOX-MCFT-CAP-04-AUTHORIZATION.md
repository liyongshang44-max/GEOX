<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION.md -->
# GEOX MCFT-CAP-04 Authorization and Predecessor Lock

## Authority

```text
authorization_id:
MCFT-CAP-04-AUTHORIZATION-V1

delivery_slice_id:
MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1

baseline_main_commit:
30fdd839aa675656dd3dc9d1def57b06f63f86ec

task:
docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md

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
P0 PR: #2379
P0 exact head: ead23d9ebc37ad9dda83e8b6b9c8af651e177fd6
P0 merge commit: 30fdd839aa675656dd3dc9d1def57b06f63f86ec
P0 postmerge workflow: 29206218494
P0 postmerge Gate: PASS
```

## PostgreSQL predecessor proof

The isolated PostgreSQL canonical read path established:

```text
active_lineage_ref:
twin_runtime_lineage_31d5cdda3c87fdf1536f0233

lineage_id:
lineage_da76d015085f0d37bf2ed478

revision_id:
revision_e0c62f99ac3db66f60a87e2b

latest_posterior_state_ref:
twin_state_estimate_0adec65ed4a2a6f8146b1b2b

latest_checkpoint_ref:
twin_runtime_checkpoint_b88792b2c77677855575a858

latest_forecast_result_ref:
twin_forecast_run_68997d774c7febc701bbbccf

latest_successful_forecast_ref:
null

predecessor_state_runtime_config_ref:
twin_runtime_config_e505fef3b2b99e88342d007f

reality_binding_ref:
mcft_rb_bf1da664164a4fedda249bcb

checkpoint_sequence:
48

next_tick_logical_time:
2026-06-03T02:00:00.000Z
```

All corresponding hashes and cross-reference relations are frozen in docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PREDECESSOR-LOCK.json. Replay Runtime Config authority is the exact State-bound Runtime Config ref/hash, not an active-config pointer.

## Delivery authority

Before S0 merge and merged-main Authorization Gate:

```text
design_status: FINAL_FROZEN_CANDIDATE_V0_5
implementation_status: NOT_AUTHORIZED
runtime_source_authorized: false
active_delivery_slice_id: MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1
next_authorized_slice_ids: []
```

After S0 merge and merged-main Authorization Gate, only this slice becomes eligible for explicit activation:

```text
MCFT-CAP-04.MCFT-02-07-09-10.FORECAST-SCENARIO-CONTRACTS-CONFIG-V1
```

## Exact changed-file boundary

- `docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md`
- `docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json`
- `docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json`
- `docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION.md`
- `docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json`
- `docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PREDECESSOR-LOCK.json`
- `docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S0-ALIGNMENT-REVIEW.md`
- `scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_AUTHORIZATION.cjs`
- `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PREDECESSOR_PREFLIGHT.ts`

No Runtime source, migration, route, scheduler, web, Forecast write, Scenario write, Recommendation, Decision, or AO-ACT is included.

## Preserved nonclaims

```text
NO_MCFT_CAP_04_RUNTIME_SOURCE_AUTHORIZATION
NO_SUCCESSFUL_FORECAST_CREATED_BY_CAP_04
NO_72_HOUR_FORECAST_CREATED_BY_CAP_04
NO_SCENARIO_CREATED_BY_CAP_04
NO_FORECAST_RESIDUAL
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_DECISION
NO_AO_ACT
NO_CALIBRATION_CANDIDATE
NO_SHADOW_EVALUATION
NO_MODEL_ACTIVATION
NO_ACTIVE_MODEL_PARAMETER_CHANGE
NO_LATE_EVIDENCE_REVISION
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_LIVE_FIELD_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```
