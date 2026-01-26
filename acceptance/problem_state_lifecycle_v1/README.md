# Acceptance · ProblemState Lifecycle v1

This acceptance suite validates **Sprint 9** governance rules for **ProblemState Lifecycle v1**.

Hard properties:
- Deterministic: all decisions use an injected `asOfTs`.
- Static: inputs are JSON fixtures; outputs are JSON expectations.
- No Ledger writes: the suite computes a governance index only.

Run via:
- `scripts/ACCEPTANCE_PROBLEMSTATE_LIFECYCLE_V1.ps1`
