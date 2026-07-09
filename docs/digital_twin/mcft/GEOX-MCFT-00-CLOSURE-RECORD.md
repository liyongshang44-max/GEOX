<!-- docs/digital_twin/mcft/GEOX-MCFT-00-CLOSURE-RECORD.md -->
# GEOX MCFT-00 Closure Record

## Record

```text
phase: MCFT-00
baseline_main_commit: 7fd848ae00680480fc864990b9d03b37bc61fdff
predecessor: DT-02 with DT02-AMENDMENT-01
successor: MCFT-01 Canonical Replay Dataset
status: PENDING_ACCEPTANCE
acceptance_status: PENDING
duplicate_implementation_pr: #2305 CLOSED_SUPERSEDED
```

## Claim boundary

```text
MCFT_00_REALITY_BINDING_FROZEN_PENDING_ACCEPTANCE
GOVERNANCE_INPUT_ONLY
TARGET_RUNTIME_MODE_REPLAY
NO_RUNTIME_IMPLEMENTATION
NO_CANONICAL_PERSISTENCE
NO_CANONICAL_REPLAY_DATASET
CONTROLLED_SYNTHETIC_REPLAY_SCOPE_ONLY
```

## Candidate frozen identity

```text
binding_id: mcft_rb_bf1da664164a4fedda249bcb
determinism_hash: sha256:bf1da664164a4fedda249bcb0e330c1af2083173a52bd704f01eac3ad277ba4f
geometry_semantic_hash: sha256:d3dbc5495485e7af68acdc4b32e6061c2ea99772835be2805ae706b74d75ca51
file_sha256: sha256:249fee97640a8291d18becb399b7ed7757de90222ad55ed1a203ebe277147ab4
derived_area_m2: 20488.479982
source_matrix_hash: sha256:c5187c23be0d058ffa23d464ae1139f924f5af064a270248746fbabde4c3e51b
configuration_matrix_hash: sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5
```

The identity changed because `ingress_adapter_version` became part of every Evidence binding's governed semantic payload. The geometry semantic identity did not change.

## Validation evidence

```text
architecture_input_head: 7fd848ae00680480fc864990b9d03b37bc61fdff
implementation_validated_head: PENDING
implementation_local_gate: PENDING
DT-02 amended regression: PENDING
DT-01 repository audit: PENDING
DT-01 acceptance: PENDING
DT-00 semantic regression: PENDING
changed-file boundary: PENDING
negative_fixture_count: PENDING
working_tree: PENDING
implementation_ci: PENDING
closure_input_head: PENDING
final_pr_head: external PR #2304 attestation
final_pr_ci: external GitHub Actions attestation
```

The previous completion evidence for head `1e7d62a68d731a36ddc229c4cf7fff717ec75df6` was invalidated by post-acceptance correctness findings. MCFT-00 may return to `COMPLETE` only after the revised package passes the full no-skip Gate and final CI.
