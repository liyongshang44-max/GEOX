# docs/twin_kernel/READ_ONLY_RECONCILIATION_ADAPTER_CONTRACT_V0.md

## Status

```text
Status: P10-06 read-only adapter contract
Phase: P10 Runtime Reconciliation Contract / Non-Persisted Candidate Adapter Proof
Authority source: README_MIGRATION.md
Acceptance: scripts/governance_acceptance/P10_06_READ_ONLY_RECONCILIATION_ADAPTER_CONTRACT_V0_ACCEPTANCE.cjs
```

## Adapter class

```text
adapter_class = offline_reconciliation_adapter
adapter_runtime_location = scripts/twin_kernel
server_runtime_adapter = false
server_route_adapter = false
database_adapter = false
frontend_adapter = false
```

## Inputs

```text
case_manifest = docs/twin_kernel/replay_cases/p8_real_evidence_closed_loop_caf009_soil_moisture_v0.json
source_data_contract = docs/twin_kernel/SOURCE_DATA_CONTRACT_V0.json
candidate_envelope_schema = docs/twin_kernel/CANDIDATE_TWIN_OBJECT_ENVELOPE_SCHEMA_V0.json
artifact_to_candidate_field_mapping = docs/twin_kernel/ARTIFACT_TO_CANDIDATE_FIELD_MAPPING_V0.json
model_version_reconciliation_contract = docs/twin_kernel/MODEL_VERSION_RECONCILIATION_CONTRACT_V0.json
fixtures = docs/twin_kernel/fixtures/p10_canonical_sample_artifacts
```

## Output bundle

```text
schema_version = candidate_twin_object_bundle_v0
case_id
candidate_count
candidates[]
persistence_status = not_persisted
write_count = 0
db_write_count = 0
fact_write_count = 0
field_memory_write_count = 0
model_update_count = 0
ao_act_task_count = 0
blocked_operations[]
```

This is not a server adapter and does not create persisted Twin Kernel objects.
