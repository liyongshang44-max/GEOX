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
---

# GEOX – Control Constitution / Repo-Const Ruleset v0 Freeze Snapshot

Key anchors:
- Branch: main
- Commit: 52c03f4
- Tag: control_repo_const_ruleset_v0

What this adds:
- Constitution docs (repo-const ruleset governance):
  - docs/controlplane/constitution/GEOX-ControlConstitution-RepoConst-Ruleset-Layout-v0.md
  - docs/controlplane/constitution/GEOX-ControlConstitution-RepoConst-Ruleset-Loading-Policy-v0.md
- Validator hardening:
  - packages/control-constitution-validator now emits type declarations (dist/index.d.ts)
  - fixtures normalized under packages/control-constitution-validator/fixtures/rulesets_v0/
- Repo-const harness (dev/test-only):
  - New package: packages/control-repo-const-harness
  - Explicit file-path ruleset loading (no scanning, no defaults)
  - Kernel-bridge mapping: validator output (rules[].expr) -> kernel consumption shape (rules[].template) in harness only
  - Negative guard: verifies no runtime package depends on harness

Acceptance / reproducibility:
- Verified on tag: pnpm -C packages/control-repo-const-harness test
  - [OK] S1 applied -> verdict: DENY
  - [OK] S2 missing -> UNDETERMINED + MISSING
  - [OK] S3 invalid -> UNDETERMINED + INVALID

Hard boundaries (must remain true):
- RuleSet v0 SSOT is repo files only (repo-const). No DB/ledger/env injection of ruleset content.
- Runtime default does NOT load rulesets. Only explicit developer/test harness may load by exact file path.
- @geox/control-kernel contains no filesystem/path/discovery logic for rulesets.
- Harness must remain non-runtime: runtime packages must not depend on control-repo-const-harness.
