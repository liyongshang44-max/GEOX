# Frontend Runtime Page Audit Report

Status: CI_ARTIFACT_SOURCE_OF_TRUTH

This checked-in document is a static audit index. The current runtime page audit result is the latest CI artifact produced by:

```bash
pnpm run ci:frontend:runtime-page-audit
```

The checked-in file must not remain a standalone PENDING status when CI has executed. For PR and release decisions, use the GitHub Actions workflow conclusion and uploaded audit artifact as the source of truth.

## Audited route set

The gate writes per-route browser audit results for:

- `/customer/dashboard`
- `/customer/export`
- `/operator/workbench`
- `/operator/approvals`
- `/operator/dispatch`
- `/operator/acceptance`
- `/operator/evidence`
- `/operator/devices-alerts`
- `/operator/roi-ledger`
- `/operator/field-memory`
- `/dev/flight-table`

## Artifact contents

The generated CI artifact includes:

- route status
- visible text sample
- console errors
- console warnings
- network 4xx/5xx
- screenshot path
- diagnosis

## Review policy

- CI artifact is authoritative for runtime page readiness.
- This markdown file only documents the gate and route coverage.
- Manual screenshots or local runs are supplementary unless they include commit SHA, command, timestamp, and captured logs.

## Machine readable summary

```json
{
  "status": "CI_ARTIFACT_SOURCE_OF_TRUTH",
  "source_of_truth": "latest_ci_artifact",
  "command": "pnpm run ci:frontend:runtime-page-audit",
  "checked_in_doc_role": "static_gate_index",
  "pending_placeholder_retired": true
}
```
