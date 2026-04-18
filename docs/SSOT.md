# GEOX Repository SSOT

This file is the repository-level single source of truth for documentation entry and governance.

## Repository-level SSOT

The only repository-level SSOT is `docs/SSOT.md`.

All other documents in `docs/**`, `README_MIGRATION.md`, `docs/controlplane/**`, `docs/controlplane/constitution/**`, and `docs/delivery/**` are domain-specific references, derived notes, or historical records unless this document explicitly states otherwise.

## Canonical repository rules

### API main entry

External API main entry is:

- `/api/v1/*`

Legacy paths may exist only as compatibility layers. They must not be treated as the primary external API surface.

### DB contract source

Database contract is defined by:

- migration files under `apps/server/db/migrations/`
- runtime health checks in `apps/server/src/server.ts`

The expected rule is:

- bootstrap contract == migration contract == healthz contract

### Runtime mode

Runtime delivery must use build artifacts.

- production/runtime entry must use built artifacts
- `tsx` is not the delivery/runtime contract
- compose/runtime paths must not rely on source-mounted live TypeScript execution as the delivery model

## Documentation layering

### Repository-level SSOT

- `docs/SSOT.md`

### Domain references

These are domain-specific references, not repository-level SSOT documents:

- `README_MIGRATION.md`
- `docs/controlplane/**`
- `docs/controlplane/constitution/**`
- `docs/delivery/**`
- `docs/qa/**`
- `docs/commercial/**`
- `docs/ci/**`

### Root README

- `README.md` is the repository landing page
- `README.md` must point to `docs/SSOT.md` as the documentation entry

## Navigation

### Repository entry

- `README.md`
- `docs/SSOT.md`

### Core engineering references

- `apps/server/db/migrations/`
- `apps/server/src/server.ts`
- `apps/server/src/routes/`
- `apps/web/src/api/`

### Domain document groups

- `docs/controlplane/`
- `docs/controlplane/constitution/`
- `docs/delivery/`
- `docs/qa/`
- `docs/commercial/`

## SSOT layering rule

Only `docs/SSOT.md` may declare repository-level SSOT status.

All subdomain documents must use domain-reference language instead of repository-level SSOT language.

## Bare /api/* path classification

Bare `/api/*` paths are not repository-level default public API entry points. Each remaining bare path must be explicitly classified as one of the following:

- `v1 public`: promoted into `/api/v1/*` and documented as public API
- `legacy compatibility`: temporary compatibility surface kept for migration only
- `internal / experimental`: non-public runtime or tooling path; must not appear in external primary API documentation

Current repository classification:

- `apps/server/src/routes/agronomy_v0.ts` → legacy compatibility
- `apps/server/src/routes/judge_config.ts` → internal / experimental
- `apps/server/src/routes/raw.ts` → legacy compatibility
- `apps/server/src/routes/series.ts` → legacy compatibility
- `apps/server/src/routes/sim_config.ts` → internal / experimental

These routes must not be treated as the default external API surface. The default external API surface remains `/api/v1/*`.
