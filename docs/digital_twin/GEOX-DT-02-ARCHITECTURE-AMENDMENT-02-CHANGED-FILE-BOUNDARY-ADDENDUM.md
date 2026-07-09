<!-- docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-02-CHANGED-FILE-BOUNDARY-ADDENDUM.md -->
# DT02-AMENDMENT-02 Changed-File Boundary Addendum

## Authority

```text
parent_amendment: DT02-AMENDMENT-02
scope: exact main-based changed-file boundary after MCFT-VERTICAL-AMENDMENT-01 merge
status: COMPLETE
```

This addendum supersedes Section 16 changed-file enumeration of `GEOX-DT-02-ARCHITECTURE-AMENDMENT-02.md` after PR #2306 merged into `main` at `5e0e7df50512168166bdee6cea9c0a0cec2916b2`.

The final exact Amendment 02 changed-file set is:

```text
docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-02-CHANGED-FILE-BOUNDARY-ADDENDUM.md
docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-02-CLOSURE-RECORD.md
docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-02.md
docs/digital_twin/GEOX-DT-02-ARCHITECTURE-DECISION-REGISTER.json
docs/digital_twin/GEOX-DT-02-ATOMIC-TRANSACTION-MATRIX.json
docs/digital_twin/GEOX-DT-02-BOOTSTRAP-STATE-SEMANTICS.json
docs/digital_twin/GEOX-DT-02-CANONICAL-OBJECT-SET.json
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md
docs/digital_twin/GEOX-DT-02-RUNTIME-ARCHITECTURE-FREEZE.md
scripts/governance_acceptance/ACCEPTANCE_DT_01_EXISTING_CAPABILITY_RECONCILIATION.cjs
scripts/governance_acceptance/ACCEPTANCE_DT_02_ARCHITECTURE_AMENDMENT_02.cjs
scripts/governance_acceptance/ACCEPTANCE_DT_02_RUNTIME_ARCHITECTURE_FREEZE.cjs
```

The predecessor artifacts below are consumed unchanged from `main` and are not Amendment 02 changed files:

```text
docs/digital_twin/GEOX-DIGITAL-TWIN-CAPABILITY-MATRIX.json
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-AMENDMENT-01.md
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json
scripts/governance_acceptance/ACCEPTANCE_MCFT_VERTICAL_CAPABILITY_LINE_AMENDMENT_01.cjs
```

The permitted DT-01 compatibility edit is strictly limited to adding exact successor Gate paths to the existing allowlist. Amendment 02 validates the merged MCFT vertical contracts directly without modifying the predecessor Gate.

Forbidden:

```text
removing or weakening any semantic assertion
adding a broad scripts/governance_acceptance/** wildcard
skipping DT-01 inventory, reuse, persistence, runtime-entry or nonclaim checks
changing merged MCFT vertical identifier, ownership, slice graph, Reality binding or capability status
changing Runtime source, migrations, fixtures, package files or workflows
```

This addendum creates no Runtime implementation and no canonical write authority.
