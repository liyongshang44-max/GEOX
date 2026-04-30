# GEOX Release Audit & Evidence Bundle V1

## 1) Purpose
`ACCEPTANCE_RELEASE_AUDIT_EVIDENCE_BUNDLE_V1` is the final Step10-I closure gate. It verifies that Step8, Step9, and Step10(A-H) still pass together and emits a reproducible evidence bundle.

## 2) Why one acceptance script is not enough
Single checks can pass while adjacent contracts regress. This audit performs runtime gates + static repo assertions + OpenAPI contract validation + legacy dependency guard in one run.

## 3) Runtime gates included
The script executes, in order:
1. `ACCEPTANCE_SECURITY_COMMERCIAL_GATE_V1.cjs` (Step10 A-H)
2. `ACCEPTANCE_VARIABLE_PRESCRIPTION_V1.cjs` (Step9)
3. `ACCEPTANCE_FIELD_MEMORY_V1.cjs` (Step8)

Any missing script, non-zero exit code, or `json.ok !== true` fails release audit.

## 4) Static checks covered
- Required Step8 files (service, route, contract, acceptance script)
- Required Step9 files (domain chain, route, acceptance script)
- Required Step10 security scripts and docs/security A-H docs
- Required hardening files (`.env.production.example`, production/staging compose files)
- Migration tokens: `field_memory_v1`, `management_zone_v1`, `security_audit_event_v1`, `fail_safe_event_v1`, `manual_takeover_v1`
- Production-code markers for variable prescription and runtime hardening/security markers.

## 5) OpenAPI contracts checked
`GET /api/v1/openapi.json` must include required schemas and paths for:
- Field Memory
- Variable Prescription chain
- Security Audit
- Fail-safe / Manual takeover

## 6) Evidence bundle outputs
Run output directory:
`artifacts/release_evidence/<timestamp>/`

Files written:
- `release_audit_summary.json`
- `security_gate_result.json`
- `variable_prescription_result.json`
- `field_memory_result.json`
- `openapi_contract_snapshot.json`
- `repo_static_checks.json`

## 7) Artifact commit rule
Do **not** commit timestamped runtime evidence files under `artifacts/release_evidence/<timestamp>/`. Only keep directory scaffolding (`.gitkeep`) and documentation in git.

## 8) Local run commands
PowerShell example:
```powershell
$env:FIELD_ID="field_c8_demo"
$env:SEASON_ID="season_demo"
$env:DEVICE_ID="dev_onboard_accept_001"
node scripts\agronomy_acceptance\ACCEPTANCE_RELEASE_AUDIT_EVIDENCE_BUNDLE_V1.cjs
```

Workspace script:
```bash
pnpm acceptance:release-audit:evidence-bundle:v1
```

## 9) Failure triage
1. Check stdout final JSON `checks` map.
2. Open `release_audit_summary.json` for group-level pass/fail.
3. Inspect per-gate JSON (`security/variable/field_memory`) for first failing chain step.
4. Inspect `repo_static_checks.json` for missing files/tokens/legacy route usage.
5. Inspect `openapi_contract_snapshot.json` for contract drift.

## 10) Step10 completion criteria
Step10 can be closed at highest bar only when Step10-I passes:
- Runtime gates all pass
- Static/migration checks pass
- OpenAPI checks pass
- Legacy-route guard passes
- Package release command exists
- Evidence bundle is successfully generated
