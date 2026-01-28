# GEOX – Sprint 10 AO-ACT v0 Freeze Snapshot

Key anchors:
- Branch: main
- Tag: apple_iii_ao_act_v0

What Sprint 10 adds:
- AO-ACT v0 execution transport (task -> executor -> receipt) as append-only facts
- Governance docs:
  - docs/controlplane/GEOX-CP-AO-ACT-Execution-Contract-v0.md  (Step 3)
  - docs/controlplane/GEOX-CP-AO-ACT-Contracts-v0.md           (Step 4)
- Acceptance:
  - scripts/ACCEPTANCE_AO_ACT_V0.ps1
  - scripts/ACCEPTANCE_AO_ACT_V0_RUNNER.mjs

Hard boundaries (must remain true):
- AO-ACT is execution & audit only (no decision / agronomy)
- No auto-trigger from ProblemState
- Append-only ledger (no rewrites)
