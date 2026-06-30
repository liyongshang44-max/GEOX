# scripts/README.md

## Status

```text
Status: derived view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
```

## Purpose

This file is a script entry guide for repository handoff. It is not a governance authority and does not replace package.json, CI, README_MIGRATION.md, or domain acceptance docs.

## Current script families

```text
governance_acceptance = scripts/governance_acceptance/**
agronomy_acceptance = scripts/agronomy_acceptance/**
frontend_acceptance = scripts/frontend_acceptance/**
commercial_acceptance = scripts/commercial_acceptance/**
twin_kernel_offline_replay = scripts/twin_kernel/**
acceptance_runner = scripts/acceptance/run_acceptance.cjs
demo_seed = scripts/demo_seed/**
dev_doctor = scripts/dev/**
legacy_powershell_acceptance = scripts/*.ps1 and scripts/DELIVERY/*.ps1
```

## Current high-confidence entrypoints

```text
ci_runtime = .github/workflows/ci.yml
local_acceptance_runner = scripts/acceptance/run_acceptance.cjs
p8_closed_loop_manual_acceptance = scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs
post_p8_convergence_acceptance = scripts/governance_acceptance/POST_P8_REPOSITORY_CONVERGENCE_ACCEPTANCE.cjs
```

## Rule for old scripts

A script is not safe to delete until a later deletion audit proves:

```text
not_called_by_package_json
not_called_by_github_actions
not_imported_by_runtime
not_called_by_current_acceptance_runner
not_listed_in_README_MIGRATION_as_freeze_evidence
not_required_by_current_domain_reference
```

## Rule for adding new scripts

New scripts must declare one of these roles in a top comment or adjacent task doc:

```text
runtime_script
acceptance_script
data_prep_script
dev_doctor_script
demo_seed_script
historical_compatibility_script
```

If a script writes the database, its role must not be described as replay runtime.
