<!-- docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION.md -->

# GEOX MCFT-CAP-06 Authorization

## S0 v2 Candidate — predecessor lock and structural dataset qualification

```text
capability_line_id: MCFT-CAP-06
authorization_id: MCFT-CAP-06-AUTHORIZATION-V1
delivery_slice_id: MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1
status: S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS
baseline_main_commit: ca819ba51bdf3017dbefa96015f76bd3b66a647c
candidate_materialization_source_commit: d059989c7c6bf3747f82653a256514dc75dee5d2
candidate_materialization_workflow_run: 29471517865

authorization_effective: false
runtime_source_authorized: false
migration_authorized: false
canonical_write_authorized: false
active_delivery_slice_id: null
```

S0 v2 reproduced the completed CAP-05 terminal chain in isolated PostgreSQL and locked the actual canonical predecessor identity. It then traversed the canonical Forecast Residual graph using repository recursive canonical hashing, exact Forecast/point/posterior/Evidence Window/Observation/Config/forcing/operator/geometry/numeric authorities, and dual-time anti-leakage checks.

## Frozen qualification result

```text
dataset_qualification_status: INSUFFICIENT_MATCHED_PAIRS
canonical_residual_count: 1
eligible_residual_count: 1
excluded_case_count: 0
invalid_graph_case_count: 0
availability_invalid_case_count: 0
case_graph_validation_status: PASS
availability_order_validation_status: PASS
homogeneity_validation_status: PASS
```

The current repository history contains one eligible canonical H1 Residual and is structurally valid, but contains fewer than the 24 matched cases required for calibration/holdout assessment. This does not block the separately isolated controlled positive mechanism track.

## Predecessor handoff

```text
active_lineage_ref: twin_runtime_lineage_31d5cdda3c87fdf1536f0233
lineage_id: lineage_da76d015085f0d37bf2ed478
revision_id: revision_e0c62f99ac3db66f60a87e2b
latest_posterior_state_ref: twin_state_estimate_9759c452882f1cdb440f5e86
latest_checkpoint_ref: twin_runtime_checkpoint_94044fb0a8fa953db55fb8e0
latest_successful_forecast_ref: twin_forecast_run_0b63c462f5e18e199a64de45
latest_scenario_set_ref: twin_scenario_set_e1991ac6814030ca6e598efc
state_bound_runtime_config_ref: twin_runtime_config_99c5271c7f541c7682d4934c
config_authority_mode: EXPLICIT_REPLAY_PIN
active_binding_status: NOT_ESTABLISHED
checkpoint_sequence: 80
reproduced_state_fact_count: 33
latest_logical_time: 2026-06-04T09:00:00.000Z
next_tick_logical_time: 2026-06-04T10:00:00.000Z
```

The historical CAP-05 value 81 is preserved as the orchestrator canonical-object fact delta. It is not reused as a State fact count; the exact isolated PostgreSQL reproduction contains 33 canonical State facts.

## Effectiveness boundary

Before merge and merged-main effectiveness activation:

```text
authorization_effective = false
runtime_source_authorized = false
active_delivery_slice_id = null
S1 = blocked
```

After this candidate merges, exact-head CI passes, head-to-merge tree equivalence is proven, and the merged-main Authorization Gate passes, a separate append-only effectiveness writeback may set:

```text
authorization_effective = true
runtime_source_authorized = true
active_delivery_slice_id = MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1
only S1 authorized
```

No Candidate, Shadow Evaluation, Model Activation, active-config switch, State mutation, checkpoint mutation, public route, Web path, scheduler, or MCFT-CAP-07 authority is granted by S0.

<!-- MCFT-CAP-06-S0-EFFECTIVENESS-BEGIN -->
## S0 merged-main effectiveness

```text
status: MERGED_EFFECTIVE
implementation_exact_head: 375adfa3ba85082c1742b30314951df61b3a1936
exact_head_ci: 29471606766 SUCCESS
merge_commit: 4c93ec59a6ac0b53b43584cbef1a7e0295d6b58a
head_to_merge_file_delta_count: 0
head_to_merge_tree_equivalence: PASS
postmerge_probe_pr: 2511 CLOSED_WITHOUT_MERGE
postmerge_workflow: 29472057972 SUCCESS
authorization_effective: true
runtime_source_authorized: true
active_delivery_slice_id: MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1
S1: AUTHORIZED_NOT_STARTED
S2_AND_LATER: BLOCKED
```

This effectiveness activation changes governance authority only. It does not append a Residual, Candidate, Evaluation, Model Activation, State, checkpoint, or active-config binding.
<!-- MCFT-CAP-06-S0-EFFECTIVENESS-END -->
