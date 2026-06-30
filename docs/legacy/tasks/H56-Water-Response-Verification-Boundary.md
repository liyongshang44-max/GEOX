# H56 — Water Response Verification Boundary

## Purpose

H56 starts a separate verification line after H55 has been closed.

H56 is not H55.1.

H56 proves that an accepted execution can be evaluated against pre/post root-zone water state evidence.

## Input boundary

H56 starts from an acceptance result and root-zone water state evidence.

```text
acceptance_result_v1
+ as_executed_record_v1
+ root_zone_soil_water_state_index_v1
→ POST /api/v1/water-response/verify-from-acceptance
→ operator_water_response_verification_submission_v1
→ water_response_verification_v1
→ water_response_verification_index_v1
```

## Allowed outputs

- `operator_water_response_verification_submission_v1`
- `water_response_verification_v1`
- `water_response_verification_index_v1`

## Explicitly out of scope

- `roi_ledger_v1`
- `field_memory_v1`
- `operation_state_v1`

## Runtime proof

H56 wraps the existing H45 runtime acceptance:

```text
scripts/runtime_acceptance/ACCEPTANCE_WATER_RESPONSE_VERIFICATION_FROM_ACCEPTANCE_V1_RUNTIME.cjs
```

The wrapped runtime verifies:

- acceptance result is read
- as-executed record is read
- pre/post root-zone water state records are read
- one water response verification fact is created
- one verification index row is created
- duplicate verification submissions are rejected
- missing or failed acceptance is rejected
- missing as-executed state is rejected
- missing pre/post state is rejected
- state time-order violations are rejected
- operator, admin, and agronomist tokens can verify
- executor, approver, client, and viewer tokens are rejected
- ROI, Field Memory, and operation-state facts are not created

## Acceptance commands

```powershell
$env:DATABASE_URL="postgres://landos:landos_pwd@127.0.0.1:5433/landos"
$env:BASE_URL="http://127.0.0.1:3001"

node scripts/governance_acceptance/ACCEPTANCE_H56_WATER_RESPONSE_BOUNDARY_V1.cjs
pnpm run typecheck:server
```

Expected result:

```text
ok = true
water_response_boundary_runtime = PASS
verification_created = true
roi_created = false
field_memory_created = false
operation_state_created = false
```
