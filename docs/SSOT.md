# GEOX Repository SSOT

This file is the repository-level single source of truth for documentation entry, authority layering, and governance conflict resolution.

## Repository-level SSOT

The only repository-level SSOT is `docs/SSOT.md`.

This means `docs/SSOT.md` owns:

- documentation entrypoint governance
- authority layering between documentation groups
- conflict-resolution rules between repository-level and domain-level documents
- repository-wide API entry classification
- repository-wide database contract source classification
- repository-wide runtime delivery classification

`docs/SSOT.md` does not restate every frozen Sprint, tag, acceptance command, or domain contract. Those records remain in their assigned domain references.

## Authority layering

GEOX uses layered authority. A lower or domain-specific document may be authoritative only inside the domain explicitly assigned here. It must not claim repository-level SSOT status.

| Layer | Authority | Scope | Conflict rule |
|---|---|---|---|
| Repository entry and governance | `docs/SSOT.md` | Documentation entry, authority model, repository-wide classification | Wins over all documents on repository-level governance |
| Migration / freeze index | `README_MIGRATION.md` | Sprint numbering, freeze snapshots, tag meaning, acceptance entrypoints, frozen capability boundaries | Wins only inside Sprint / Tag / Freeze state |
| Control constitution references | `docs/controlplane/constitution/README.md` and the documents listed there | Control-plane semantic prohibitions and constitution-level control semantics | Wins only inside control-plane constitution semantics, unless it conflicts with this SSOT's repository-level authority model |
| Control-plane contracts | `docs/controlplane/**` | AO-ACT, execution, audit, authz, and control-plane contracts | Domain reference only; must defer to the constitution layer and this SSOT |
| Delivery references | `docs/delivery/**` | Delivery envelope, acceptance aggregation, evidence export packaging | Domain reference only; must not define runtime semantics unless separately frozen in `README_MIGRATION.md` |
| QA references | `docs/qa/**` | Test plans, audit notes, validation references | Domain reference only; must not define product or runtime authority |
| Commercial references | `docs/commercial/**` | Customer-facing or commercial packaging references | Domain reference only; must not override engineering or governance contracts |
| Contract proposals | `docs/contracts/v2/**` | Proposed Base Contract v2 governance baseline | Proposed baseline only; no completion or runtime authority by itself |
| Root README | `README.md` | Repository landing page for humans | Navigation only; not an authority source |

## Domain authority rules

### `README_MIGRATION.md`

`README_MIGRATION.md` is the canonical migration and freeze index for:

- Sprint numbering and scope
- freeze snapshots
- git tags that lock governance and execution semantics
- acceptance commands that prove frozen invariants
- hard boundaries attached to frozen milestones

It may say it is the only canonical Sprint / Tag / Freeze index. That claim is valid only for Sprint / Tag / Freeze state. It must not be interpreted as repository-level SSOT status.

If a document conflicts with `README_MIGRATION.md` about Sprint / Tag / Freeze state, `README_MIGRATION.md` wins.

If `README_MIGRATION.md` conflicts with `docs/SSOT.md` about repository-level entry, authority layering, API entry classification, DB contract source classification, or runtime delivery classification, `docs/SSOT.md` wins.

### `docs/controlplane/constitution/**`

The control-plane constitution documents may define semantic prohibitions and order-of-authority rules inside the control-plane domain.

They must not claim repository-level SSOT status. Their authority is domain-specific and is recognized through this SSOT.

### Other domain documents

All other documents in `docs/**` are domain-specific references, derived views, proposals, or historical records unless this document explicitly assigns them authority.

No other document may create a competing repository-level authority model.

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

### Contract governance baselines

- `docs/contracts/v2/`

`docs/contracts/v2/*` are proposed governance baseline documents for Base Contract v2. They are not repository-level SSOT by themselves and do not claim implementation completion, CI enforcement, runtime blocking, business correctness, or commercial readiness unless separately proven.

## Documentation layering

### Repository-level SSOT

- `docs/SSOT.md`

### Recognized domain references

These are domain-specific references, not repository-level SSOT documents:

- `README_MIGRATION.md`
- `docs/controlplane/**`
- `docs/controlplane/constitution/**`
- `docs/delivery/**`
- `docs/qa/**`
- `docs/commercial/**`
- `docs/ci/**`
- `docs/contracts/v2/**`

### Root README

- `README.md` is the repository landing page
- `README.md` must point to `docs/SSOT.md` as the documentation entry
- `README.md` may link to `README_MIGRATION.md` as the Sprint / Tag / Freeze index
- `README.md` must not claim to be a governance authority

## Navigation

### Repository entry

- `README.md`
- `docs/SSOT.md`

### Freeze and milestone reference

- `README_MIGRATION.md`

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
- `docs/contracts/v2/`

## SSOT layering rule

Only `docs/SSOT.md` may declare repository-level SSOT status.

Domain documents may declare domain authority only when the domain is explicitly recognized in this file. They must use domain-reference language and must not claim repository-level governance authority.

Any new index-like document must declare one of the following statuses in its first section:

- `repository-level SSOT` — forbidden unless the file is `docs/SSOT.md`
- `domain reference` — allowed only for a named domain recognized here
- `derived view` — allowed, but must link to its authority source
- `historical record` — allowed, but must not define current authority
- `proposal` — allowed, but must not claim implementation or runtime authority

## Forbidden competing authority files

Do not introduce a competing repository-level authority file, including:

- `SPRINT_INDEX.md` as repository-level authority
- `MIGRATION_INDEX.md` as repository-level authority
- `GOVERNANCE_INDEX.md` as repository-level authority
- `CHANGELOG.md` as repository-level authority
- any new `SSOT*.md` outside `docs/SSOT.md`

A file may use those names only if its first section marks it as non-authoritative and links to the relevant authority source.

## Conflict resolution

When two documents appear to conflict, resolve in this order:

1. Identify the conflict domain.
2. If the conflict is about repository-level entry, authority layering, API entry classification, DB contract source, or runtime delivery model, `docs/SSOT.md` wins.
3. If the conflict is about Sprint / Tag / Freeze state, `README_MIGRATION.md` wins.
4. If the conflict is about control-plane constitution semantics, the constitution document recognized by `docs/controlplane/constitution/README.md` wins inside that domain, unless it conflicts with this SSOT's repository-level authority model.
5. If the conflict is about implementation behavior, code and migrations prove actual behavior; documentation must be corrected to match proven runtime facts.
6. If the conflict cannot be classified, treat `docs/SSOT.md` as the temporary authority and open a governance issue before changing semantics.

## Bare `/api/*` path classification

Bare `/api/*` paths are not repository-level default public API entry points. Each remaining bare path must be explicitly classified as one of the following:

- `v1 public`: promoted into `/api/v1/*` and documented as public API
- `legacy compatibility`: temporary compatibility surface kept for migration only
- `internal / experimental`: non-public runtime or tooling path; must not appear in external primary API documentation

Current repository classification:

- `apps/server/src/routes/agronomy_v0.ts` -> legacy compatibility
- `apps/server/src/routes/judge_config.ts` -> internal / experimental
- `apps/server/src/routes/raw.ts` -> legacy compatibility
- `apps/server/src/routes/series.ts` -> legacy compatibility
- `apps/server/src/routes/sim_config.ts` -> internal / experimental

These routes must not be treated as the default external API surface. The default external API surface remains `/api/v1/*`.
