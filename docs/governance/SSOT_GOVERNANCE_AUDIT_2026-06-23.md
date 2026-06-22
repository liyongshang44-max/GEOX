# SSOT Governance Audit — 2026-06-23

## Purpose

This audit records the repository documentation authority cleanup performed for GEOX SSOT governance.

The change is documentation-only. It does not modify runtime code, database migrations, API behavior, acceptance scripts, governance semantics, AO-ACT semantics, Judge semantics, Agronomy semantics, or delivery behavior.

## Files inspected

- `docs/SSOT.md`
- `README_MIGRATION.md`
- `README.md`
- `docs/controlplane/constitution/README.md`

## Finding

The repository already had the correct starting point:

- `docs/SSOT.md` declared itself as the only repository-level SSOT.
- `README_MIGRATION.md` declared itself as a domain-specific reference.
- `README_MIGRATION.md` also declared that it is the only canonical index for Sprint / Tag / Freeze state and that it wins on conflicts or drift.
- `docs/controlplane/constitution/README.md` declared domain-specific control-plane authority for constitution semantics.

The conflict was not implementation-level. It was an authority-layering ambiguity.

The ambiguous part was that `README_MIGRATION.md` used strong winning language without a repository-level clarification in `docs/SSOT.md` that this winning scope is limited to Sprint / Tag / Freeze state.

## Change made

`docs/SSOT.md` now explicitly defines a layered authority model:

1. `docs/SSOT.md` is the only repository-level authority for documentation entry and governance layering.
2. `README_MIGRATION.md` is the canonical authority only for Sprint / Tag / Freeze state.
3. `docs/controlplane/constitution/**` may define control-plane semantic prohibitions and constitution rules only inside the control-plane domain.
4. Other `docs/**` groups are domain references, proposals, derived views, or historical records unless explicitly recognized by `docs/SSOT.md`.

## Conflict-resolution rule after this change

If the conflict is about repository-level entry, authority layering, API entry classification, DB contract source, or runtime delivery model, `docs/SSOT.md` wins.

If the conflict is about Sprint / Tag / Freeze state, `README_MIGRATION.md` wins.

If the conflict is about control-plane constitution semantics, the constitution document recognized by `docs/controlplane/constitution/README.md` wins inside that domain, unless it conflicts with the repository-level authority model in `docs/SSOT.md`.

If the conflict is about actual implementation behavior, code and migrations prove actual behavior, and documentation must be corrected to match proven runtime facts.

## Explicit non-changes

This audit does not:

- redefine any Sprint scope;
- change any tag meaning;
- change any acceptance command;
- change any API path;
- change any database contract;
- promote any `/api/*` legacy path;
- change AO-ACT authority;
- change Judge behavior;
- change Agronomy behavior;
- change delivery behavior;
- introduce a new repository-level governance index.

## Follow-up recommendation

A later cleanup may update the top section of `README_MIGRATION.md` to mirror the same scoped-language wording. That cleanup should be text-only and must not rewrite freeze history.
