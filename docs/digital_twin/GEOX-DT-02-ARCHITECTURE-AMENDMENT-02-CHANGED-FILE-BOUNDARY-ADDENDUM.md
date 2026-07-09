<!-- docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-02-CHANGED-FILE-BOUNDARY-ADDENDUM.md -->
# DT02-AMENDMENT-02 Changed-File Boundary Addendum

## Authority

```text
parent_amendment: DT02-AMENDMENT-02
scope: exact predecessor-Gate compatibility only
status: PENDING_ACCEPTANCE
```

This addendum supersedes only Section 16 changed-file enumeration of `GEOX-DT-02-ARCHITECTURE-AMENDMENT-02.md` by adding the following exact compatibility files:

```text
scripts/governance_acceptance/ACCEPTANCE_DT_01_EXISTING_CAPABILITY_RECONCILIATION.cjs
scripts/governance_acceptance/ACCEPTANCE_MCFT_VERTICAL_CAPABILITY_LINE_AMENDMENT_01.cjs
```

The permitted changes are strictly limited to:

```text
DT-01:
  add exact successor Gate paths to its existing allowlist

MCFT Vertical Amendment 01:
  add an explicit semantic-only successor regression mode
  retain all identifier, ownership, nonclaim, Reality-binding and capability-inflation checks
  skip only its own historical git-scope comparison when invoked by a later accepted successor
```

Forbidden:

```text
removing or weakening any semantic assertion
adding a broad scripts/governance_acceptance/** wildcard
skipping DT-01 inventory, reuse, persistence, runtime-entry or nonclaim checks
skipping MCFT vertical identifier, ownership, slice graph, Reality binding or capability status checks
changing Runtime source, migrations, fixtures, package files or workflows
```

This addendum creates no Runtime implementation and no canonical write authority.
