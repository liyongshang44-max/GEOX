# PR-18I Hotfix CI Guardrail Report

## Incident

Multiple follow-up PRs were merged after #1915. #1915 had a failed CI run, and #1916–#1921 did not show PR-triggered workflow runs through the available workflow query. These PRs repeatedly appended `formalAcceptanceId()` to `apps/server/src/projections/guarded_report_v1.ts`, leaving `main` with duplicate helper definitions that block TypeScript.

## Root Cause

- Duplicate helper definitions were introduced by repeated follow-up PRs.
- Merge process did not block failed or missing CI runs.

## Fix

- Keep exactly one `formalAcceptanceId()` helper.
- Preserve the real `formal_acceptance_id` gate in `isFormalCustomerValueItem()`.
- Restore TypeScript pass.
- Require CI checks before merge.

## Verification

- `pnpm -r typecheck`
- `pnpm -r build`
- CI `build-test`
- CI `acceptance`

## Required Main Branch Protection

Configure the `main` branch protection rule in GitHub repository settings to require:

- Pull requests before merging.
- Status checks to pass before merging.
- Branches to be up to date before merging.
- No bypassing of the above settings.

Required checks should include the actual GitHub check names for:

- `ci / build-test`
- `ci / acceptance`

Pending, failed, or skipped required checks must block merging.
