# H55 — Acceptance Boundary

## Purpose

H55 starts a separate formal-evaluation line after H54 has been closed.

H55 is not H54.9.

H55 proves that formal evidence artifacts can be evaluated into an acceptance result through the existing acceptance route.

## Input boundary

H55 starts from formal evidence artifacts already materialized by the prior chain.

```text
evidence_artifact_v1
→ POST /api/v1/acceptance/from-evidence-artifacts
→ operator_acceptance_result_submission_v1
→ acceptance_result_v1
```

## Allowed outputs

- `operator_acceptance_result_submission_v1`
- `acceptance_result_v1`

## Explicitly out of scope

- `water_response_verification_v1`
- `roi_ledger_v1`
- `field_memory_v1`

## Runtime proof

H55 wraps the existing H44 runtime acceptance:

```text
scripts/runtime_acceptance/ACCEPTANCE_RESULT_FROM_EVIDENCE_ARTIFACTS_V1_RUNTIME.cjs
```

The wrapped runtime verifies:

- formal evidence artifacts are read
- one acceptance submission fact is created
- one acceptance result fact is created
- duplicate submissions are rejected
- simulated evidence is rejected
- executor / approver / client / viewer roles are rejected for evaluation
- water-response verification, ROI, and Field Memory are not created

## Acceptance commands

```powershell
$env:DATABASE_URL="postgres://landos:landos_pwd@127.0.0.1:5433/landos"
$env:BASE_URL="http://127.0.0.1:3001"

node scripts/governance_acceptance/ACCEPTANCE_H55_ACCEPTANCE_BOUNDARY_V1.cjs
pnpm run typecheck:server
```

Expected result:

```text
ok = true
acceptance_boundary_runtime = PASS
acceptance_created = true
verification_created = false
roi_created = false
field_memory_created = false
```
