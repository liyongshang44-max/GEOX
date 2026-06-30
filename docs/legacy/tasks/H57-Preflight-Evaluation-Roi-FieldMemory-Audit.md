# H57-PREFLIGHT — Evaluation / ROI / Field Memory Capability Audit

## Purpose

H57-PREFLIGHT is a repository-fact audit before any new ROI or Field Memory implementation work.

This task is intentionally not a runtime chain extension.

It exists because H54 through H56 produced too many small task PRs. Further work must be planned from repository facts rather than from the next available wrapper.

## Current merged boundary facts

| Line | Boundary | Status |
|---|---|---|
| H54 | control / approval / task / execution evidence chain | merged and closed |
| H55 | evidence artifact to acceptance result | merged and closed |
| H56 | acceptance result plus root-zone state to water response verification | merged |

## Open cleanup fact

The earlier H56 index PR was intentionally closed without merge because it was too granular.

## Audit questions

This audit answers:

1. Which H54-H56 task docs and governance wrappers exist on `main`?
2. Which existing ROI files are already present?
3. Which existing Field Memory files are already present?
4. Should the next work be implementation, consolidation, or no-op governance?

## Known repository capabilities to verify

### ROI

Expected existing capability files:

- `apps/server/src/routes/roi_ledger_v1.ts`
- `apps/server/src/domain/roi/roi_ledger_v1.ts`
- `apps/server/db/migrations/2026_04_24_roi_ledger_v1.sql`
- `scripts/agronomy_acceptance/ACCEPTANCE_ROI_LEDGER_V1.cjs`

Important route facts to inspect before any implementation:

- `POST /api/v1/roi-ledger/from-as-executed`
- `POST /api/v1/roi-ledger/formalize-from-acceptance`

### Field Memory

Expected existing capability files:

- `apps/server/src/routes/field_memory_v1.ts`
- `apps/server/src/services/field_memory_service.ts`
- `apps/server/db/migrations/2026_04_27_field_memory_v1.sql`
- `scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs`

## Planning rule after this audit

Do not continue as:

```text
H57.1
H57.2
H57.3
```

Instead, produce a compact plan with at most these lines:

```text
H57 — ROI Boundary
H58 — Field Memory Boundary
```

Each line should be at most:

```text
one implementation PR + one closure/index PR
```

If audit shows the implementation already exists, skip implementation and only create the missing governance boundary.

## Acceptance commands

```powershell
node scripts/governance_acceptance/H57_PREFLIGHT_AUDIT.cjs
pnpm run typecheck:server
```

Expected result:

```text
ok = true
h57_preflight_audit = PASS
merged_chain_audited = true
roi_capability_present = true
field_memory_capability_present = true
next_step_requires_plan = true
```
