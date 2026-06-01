# Controlled Pilot Readiness Report

Status: CI_ARTIFACT_SOURCE_OF_TRUTH

This checked-in document is a static audit note. It must not be treated as the current release decision record when GitHub Actions has produced newer controlled-pilot evidence.

The previous checked-in FAIL sample has been retired because it represented an older local/manual snapshot, not the current PR release gate result. Current controlled-pilot readiness is determined by the latest CI artifact and workflow conclusion for:

```bash
pnpm run ci:controlled-pilot
```

## Current policy

- Do not submit stale FAIL/PASS samples as the release truth.
- Use the latest CI run artifact as the source of truth.
- If local/manual execution is needed, attach its timestamp, commit SHA, command, and logs before treating it as evidence.
- Static audit docs may summarize CI status, but they must not override CI artifacts.

## Required gate family

- runtime worker packaging and liveness gates
- controlled pilot strict release gate
- frontend runtime page audit
- scenario productization release gate
- commercial MVP0 release gate

## Runtime worker liveness policy

```json
{
  "source": "worker_runtime_heartbeat_v1",
  "logs_role": "diagnostic_only",
  "gate_id": "runtime_workers"
}
```

## Pilot eligible scenarios

- FORMAL_IRRIGATION
- FORMAL_PEST_DISEASE_INSPECTION
- DEVICE_ANOMALY

## Experimental scenarios

- FORMAL_FERTILIZATION

## Known limits

- FORMAL_FERTILIZATION remains experimental unless CI promotes it into the controlled-pilot release gate.
- Docker logs are diagnostic only; the release gate must rely on structured gate outputs and CI artifacts.

## Machine readable summary

```json
{
  "status": "CI_ARTIFACT_SOURCE_OF_TRUTH",
  "stale_fail_sample_retired": true,
  "current_release_truth": "latest_ci_artifact",
  "required_command": "pnpm run ci:controlled-pilot",
  "runtime_worker_liveness": {
    "source": "worker_runtime_heartbeat_v1",
    "logs_role": "diagnostic_only",
    "gate_id": "runtime_workers"
  },
  "pilot_eligible_scenarios": [
    "FORMAL_IRRIGATION",
    "FORMAL_PEST_DISEASE_INSPECTION",
    "DEVICE_ANOMALY"
  ],
  "experimental_scenarios": [
    "FORMAL_FERTILIZATION"
  ]
}
```
