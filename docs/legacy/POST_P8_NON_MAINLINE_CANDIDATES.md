# docs/legacy/POST_P8_NON_MAINLINE_CANDIDATES.md

## Status

```text
Status: derived view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
```

## Purpose

This file identifies repository areas that may pollute handoff if treated as current entrypoints.

It is not a deletion list. It is a classification queue. Deletion, relocation, or archival requires a later reference audit and acceptance proof.

## Classification states

```text
current_mainline = safe current entrypoint
current_domain_reference = current but domain-scoped
historical_record = preserve as freeze/audit record
legacy_compatibility = may be kept for compatibility but not as default entrypoint
candidate_for_archive = may move to clearer legacy/archive location after reference audit
candidate_for_deletion = may delete only after reference audit proves no current dependency
unknown = inspect before use
```

## Candidate groups

```text
docs/tasks/P0-* through P7-* = historical_record or candidate_for_archive after README_MIGRATION reference audit
docs/tasks/P8-* = current_domain_reference for offline real-evidence replay
docs/tasks/TK* = current_domain_reference for persisted Twin Kernel only when linked to current TK routes or migrations
docs/controlplane/** = current_domain_reference governed by control-plane constitution
docs/delivery/** = current_domain_reference for delivery only
docs/commercial/** = current_domain_reference for commercial packaging only
scripts/ACCEPTANCE_*.ps1 = historical_record or legacy_compatibility until README_MIGRATION/package/CI audit proves otherwise
scripts/governance_acceptance/P8_* = current_domain_reference for offline P8 replay
scripts/twin_kernel/P8_* = current_domain_reference for offline P8 replay
scripts/twin_kernel/P7_* = historical_record or candidate_for_archive after import/reference audit
apps/web/** = frontend runtime; do not delete without router and CI audit
apps/server/src/routes/** = server runtime; do not delete without route registry and OpenAPI audit
```

## Immediate cleanup rule

Do not delete in this convergence pass.

Instead:

```text
1. Mark current entrypoints in docs/REPOSITORY_HANDOFF_MAP.md.
2. Mark Twin lineage in docs/twin_kernel/README.md.
3. Mark script entrypoints in scripts/README.md and scripts/twin_kernel/README.md.
4. Run POST_P8_REPOSITORY_CONVERGENCE_ACCEPTANCE.
5. Create a later archive/delete PR only for files proven unreferenced.
```

## Archive naming rule for later PRs

If historical material is moved instead of deleted, use explicit non-mainline paths:

```text
docs/legacy/tasks/<original-file-name>
scripts/legacy/acceptance/<original-file-name>
scripts/legacy/replay/<original-file-name>
```

Every moved file must keep a header saying it is non-authoritative historical material and must link to its replacement or current entrypoint.
