<!-- docs/frontend-productization/PFE-12-RELEASE-CANDIDATE-CHECKLIST.md -->
# PFE-12 Release Candidate Checklist

## Evidence map

| area | requirement | evidence | command or document | blocker |
|---|---|---|---|---|
| Scope | route topology unchanged | changed-file guard | `ACCEPTANCE_PFE_12_DEMO_MODE_RELEASE_CANDIDATE.cjs` | yes |
| Customer | Customer 9 surfaces covered | manifest count | `PFE-12-DEMO-MANIFEST.json` | yes |
| Operator | Operator 13 surfaces covered | manifest count | `PFE-12-DEMO-MANIFEST.json` | yes |
| Admin | Admin 7 surfaces covered | manifest count | `PFE-12-DEMO-MANIFEST.json` | yes |
| Supporting | supporting surfaces listed | manifest supporting list | `PFE-12-DEMO-MANIFEST.json` | yes |
| PFE-6 | accessibility baseline present | baseline document | `PFE-6-ACCESSIBILITY-KEYBOARD-COMPLIANCE.md` | yes |
| PFE-7 | responsive baseline present | baseline document | `PFE-7-RESPONSIVE-VIEWPORT-COMPLETION.md` | yes |
| PFE-8 | explicit state baseline present | baseline document | `PFE-8-EMPTY-LOADING-ERROR-STATE-COMPLETION.md` | yes |
| PFE-9 | screenshot baseline present | manifest and capture script | `PFE-9-SCREENSHOT-MANIFEST.json`; `CAPTURE_PFE_9_SCREENSHOTS.cjs` | yes |
| PFE-10 | bundle baseline present | budget config and checker | `PFE-10-BUNDLE-BUDGET.json`; `CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs` | yes |
| PFE-11 | copy baseline present | matrix and acceptance | `PFE-11-COPY-MATRIX.md`; `ACCEPTANCE_PFE_11_PRODUCT_COPY_I18N_COMPLETION.cjs` | yes |
| Manifest | boundary flags false | manifest booleans | `PFE-12-DEMO-MANIFEST.json` | yes |
| Seed | dry-run review path present | package script and seed file | `seed:controlled-pilot:frontend-demo:dry-run` | yes |
| Seed | tenant guard present | seed file | `SEED_CONTROLLED_PILOT_FRONTEND_DEMO_V1.cjs` | yes |
| Walkthrough | route path documented | walkthrough table | `PFE-12-WALKTHROUGH.md` | yes |
| Walkthrough | claims to avoid documented | walkthrough section | `PFE-12-WALKTHROUGH.md` | yes |
| Register | blockers documented | issue register | `PFE-12-RELEASE-CANDIDATE-ISSUE-REGISTER.md` | yes |
| Runtime | runtime audit green | CI acceptance job | GitHub Actions | yes |
| Typecheck | web typecheck green | local or CI result | `pnpm run typecheck:web` | yes |
| Build | web build green | local or CI result | `pnpm run build:web` | yes |
| Bundle check | budget check green | checker output | `CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs` | yes |
| Artifacts | generated artifacts not committed | git status and static gate | `git status --short` | yes |

## Gate phrase compatibility

```text
PFE-6 baseline present
PFE-10 baseline present
PFE-11 baseline present
Runtime audit green
```

## Local review commands

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_PFE_12_DEMO_MODE_RELEASE_CANDIDATE.cjs
pnpm run build:web
node scripts/frontend_acceptance/CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs
pnpm run typecheck:web
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FRONTEND_DEMO_V1.cjs --dry-run
git status --short
```

## Meaning

This checklist marks a demo-safe candidate artifact. It is not a launch approval.
