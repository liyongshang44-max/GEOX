# CI Acceptance Secrets Prerequisite

This document defines the mandatory token secret prerequisite for the acceptance workflow in GitHub Actions.

## Required secret (at least one must be configured)

Configure **at least one** of the following repository secrets in GitHub Actions:

- `GEOX_ACCEPTANCE_TOKEN` (**recommended**)
- `GEOX_AO_ACT_TOKEN` (compatibility fallback)

Acceptance workflow behavior:

1. Prefer `GEOX_ACCEPTANCE_TOKEN`.
2. Fallback to `GEOX_AO_ACT_TOKEN` when the recommended secret is absent.
3. If both are missing, workflow must fail at `Prepare commercial compose env` with a clear missing GitHub Actions secret error.

## Why this is required

The acceptance job generates `.env.ci` from the configured secret and uses it to:

- render `docker-compose.commercial_v1.yml`
- start runtime dependencies for acceptance
- inject `GEOX_AO_ACT_TOKEN` / `GEOX_TOKEN` for test runtime

Without either secret, acceptance cannot run.

## Cleanup behavior when `.env.ci` is missing

`Stop acceptance runtime dependencies` must be safe when `.env.ci` does not exist.

Expected behavior:

- print: `skip cleanup: .env.ci missing`
- exit successfully (no `exit 1`)
- avoid creating a second failure that masks the primary secret-missing failure

## Customer Report Boundary Suite

The customer report boundary suite must be run through the dedicated package script:

```powershell
pnpm run ci:customer-report-boundary-suite
```

Required runtime environment:

- `GEOX_BASE_URL`
- one of:
  - `GEOX_AO_ACT_TOKEN`
  - `GEOX_TOKEN`

The suite intentionally does not advertise cookie-only authentication. Customer report runtime acceptance derives the HTTP `Authorization: Bearer ...` header from the accepted CI token variables above.

The suite currently covers:

- `ci:frontend:customer-operator-inventory-boundary`
- `ci:frontend:customer-report-route-contract`
- `ci:frontend:customer-report-api-consumption-contract`
- `ci:frontend:customer-report-payload-boundary`
- `ci:runtime:customer-report-auth-boundary`
- `ci:runtime:customer-report-payload-boundary`
- `ci:customer-dashboard-aggregate-server-contract`
- `ci:customer-report-server-projector-contract`
