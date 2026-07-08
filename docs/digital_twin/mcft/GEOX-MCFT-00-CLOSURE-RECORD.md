<!-- docs/digital_twin/mcft/GEOX-MCFT-00-CLOSURE-RECORD.md -->
# GEOX MCFT-00 Closure Record

## Record

```text
phase: MCFT-00
baseline_main_commit: 7fd848ae00680480fc864990b9d03b37bc61fdff
predecessor: DT-02 with DT02-AMENDMENT-01
successor: MCFT-01 Canonical Replay Dataset
status: PENDING_ACCEPTANCE
```

## Claim boundary

```text
MCFT_00_REALITY_BINDING_FROZEN
GOVERNANCE_INPUT_ONLY
TARGET_RUNTIME_MODE_REPLAY
NO_RUNTIME_IMPLEMENTATION
NO_CANONICAL_PERSISTENCE
NO_CANONICAL_REPLAY_DATASET
CONTROLLED_SYNTHETIC_REPLAY_SCOPE_ONLY
```

## Frozen identity

```text
binding_id: mcft_rb_83d0e3cf728d257277225fee
determinism_hash: sha256:83d0e3cf728d257277225fee220dfec1029abb52e3a18b40f3801cd1bba187bf
geometry_semantic_hash: sha256:d3dbc5495485e7af68acdc4b32e6061c2ea99772835be2805ae706b74d75ca51
file_sha256: sha256:249fee97640a8291d18becb399b7ed7757de90222ad55ed1a203ebe277147ab4
derived_area_m2: 20488.479982
```

## Validation evidence

```text
architecture_input_head: 7fd848ae00680480fc864990b9d03b37bc61fdff
validated_head: PENDING
local_gate: PENDING
DT-02 regression: PENDING
DT-01 audit: PENDING
DT-01 acceptance: PENDING
DT-00 regression: PENDING
changed-file boundary: PENDING
negative_fixture_count: PENDING
working_tree: PENDING
validated_ci: PENDING
final_pr_head: external PR attestation
final_pr_ci: external GitHub Actions attestation
```

Tracked content cannot contain the SHA of its own commit. Final PR head and CI are attested in the PR description and locked-head merge request.

MCFT-01 is blocked until this record is changed to `COMPLETE` after final-byte Gate and CI success.
