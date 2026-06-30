# docs/REPOSITORY_HANDOFF_MAP.md

## Status

```text
Status: derived view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
```

## Purpose

This file is a handoff map for implementers after P8. It is not a repository-level SSOT and does not override `docs/SSOT.md` or `README_MIGRATION.md`.

Its purpose is to separate current entrypoints from historical, experimental, and domain-specific material so future work does not accidentally follow an obsolete path.

## Current authority entrypoints

```text
repository_level_governance = docs/SSOT.md
sprint_tag_freeze_index = README_MIGRATION.md
root_human_landing_page = README.md
```

## Current server runtime entrypoints

```text
server_entry = apps/server/src/server.ts
server_bootstrap = apps/server/src/bootstrap/server.ts
app_composition = apps/server/src/app.ts
domain_module_registry = apps/server/src/modules/domain/registerDomainModules.ts
external_api_surface = /api/v1/*
```

## Current Twin entrypoints

```text
persisted_twin_kernel_domain_reference = docs/twin_kernel/README.md
persisted_twin_kernel_routes = apps/server/src/routes/v1/twin_kernel.ts
persisted_twin_kernel_domain_code = apps/server/src/domain/twin_kernel/**
persisted_twin_kernel_trace_acceptance = scripts/governance_acceptance/TK10_PERSISTED_TWIN_TRACE_RUNTIME_ACCEPTANCE_V1.cjs
offline_real_evidence_replay_reference = docs/tasks/P8-10-Real-Evidence-Closed-Loop-Completion-Review.md
offline_real_evidence_replay_entry = scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs
offline_real_evidence_replay_runtime = scripts/twin_kernel/P8_*.cjs
```

## Current CI and acceptance entrypoints

```text
github_actions_ci = .github/workflows/ci.yml
local_acceptance_runner = scripts/acceptance/run_acceptance.cjs
p8_manual_acceptance = scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs
post_p8_convergence_acceptance = scripts/governance_acceptance/POST_P8_REPOSITORY_CONVERGENCE_ACCEPTANCE.cjs
```

## Do not treat these as default entrypoints

```text
historical_task_docs = docs/tasks/* unless referenced by README_MIGRATION.md or current handoff docs
random_acceptance_scripts = scripts/**/*ACCEPTANCE*.cjs unless referenced by package.json, CI, README_MIGRATION.md, or a current domain README
legacy_bare_api_paths = /api/* outside /api/v1/* unless classified in docs/SSOT.md
old_delivery_exports = _exports/** and runtime/** generated artifacts; never commit as source
```

## Handoff rule

Before starting a new implementation, identify which line the task belongs to:

```text
server_persisted_runtime
offline_replay_experiment
control_plane_execution
evidence_delivery
frontend_presentation
historical_governance_record
```

If the task touches more than one line, create an explicit reconciliation contract before writing runtime code.
