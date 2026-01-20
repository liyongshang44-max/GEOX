# 🍎 Apple II · Judge — Frozen Appendix
Doc ID: GEOX-AII-00-APP-A
Status: FROZEN
Applies to: Apple II (Judge)

This appendix is the single-source list of frozen enums and field-level constraints for Apple II, derived from the frozen JSON Schemas under `packages/contracts/`.

## One-way Dependency (FROZEN)

Allowed:
1) Evidence / State → ProblemStateV1
2) ProblemStateV1 → LBCandidateV1
3) ProblemStateV1 → AO-SENSE

Forbidden:
- LBCandidateV1 → ProblemStateV1
- AO-SENSE without ProblemStateV1
- ReferenceViewV1 → AO-SENSE (standalone)
- Any control / permission / recommendation semantics in Apple II

## Enums (FROZEN)

### ProblemStateV1.problem_type
- `INSUFFICIENT_EVIDENCE`
- `TIME_COVERAGE_GAPPY`
- `EVIDENCE_STALE`
- `EVIDENCE_CONFLICT`
- `REFERENCE_CONFLICT`
- `SENSOR_SUSPECT`
- `SENSOR_HEALTH_DEGRADED`
- `QC_CONTAMINATION`
- `REFERENCE_MISSING`
- `SCALE_POLICY_BLOCKED`
- `WINDOW_NOT_SUPPORT`
- `EXCLUSION_WINDOW_ACTIVE`
- `MARKER_PRESENT`

### ProblemStateV1.confidence
- `HIGH`
- `MEDIUM`
- `LOW`
- `UNKNOWN`

### ProblemStateV1.uncertainty_sources[]
- `SPARSE_SAMPLING`
- `MISSING_KEY_METRIC`
- `TIME_GAPS`
- `STALE_EVIDENCE`
- `MULTI_SOURCE_CONFLICT`
- `MULTI_METRIC_CONFLICT`
- `QC_SUSPECT_OR_BAD`
- `SENSOR_HEALTH_ISSUE`
- `REFERENCE_NOT_AVAILABLE`
- `SCALE_POLICY_LIMITATION`
- `EXCLUSION_WINDOW`
- `MARKER_DEPENDENCY`

### ProblemStateV1.state_layer_hint
- `atomic`
- `derived`
- `memory`
- `unknown`

### ProblemStateV1.rate_class_hint
- `fast`
- `mid`
- `slow`
- `unknown`

### ProblemStateV1.problem_scope
- `sensor_point`
- `spatial_unit`
- `reference_view`
- `unknown`

### ProblemStateV1.supporting_evidence_refs[].kind
- `ledger_slice`
- `state_vector`
- `reference_view`
- `qc_summary`

### ReferenceViewV1.kind
- `WITHIN_UNIT_HISTORY`
- `WITHIN_UNIT_CONTROL_SENSOR`
- `NEIGHBOR_SAME_SCALE`
- `EXTERNAL_CONTEXT`

### ReferenceViewV1.sample_type


### LBCandidateV1.lb_status


### LBCandidateV1.confidence


## Fixtures (FROZEN)

Canonical fixtures are stored under:
- `fixtures/appleii/psv1_demo_001.json`
- `fixtures/appleii/psv1_demo_002.json`
- `fixtures/appleii/psv1_demo_003.json`

These fixtures MUST validate against `packages/contracts/problem_state_v1.schema.json`.
