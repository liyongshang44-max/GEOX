<!-- docs/frontend-productization/PFE-13-FREEZE-CHECKLIST.md -->
# PFE-13 Freeze Checklist

## Checklist status

This checklist records the evidence required to freeze Formal Product Frontend v1. It is not a launch approval.

| area | requirement | evidence file | acceptance command | status | blocker if failed |
|---|---|---|---|---|---|
| Freeze manifest | phase, version, mode, and frozen flag valid | `PFE-13-FREEZE-MANIFEST.json` | `ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs` | required | yes |
| Freeze manifest | non-launch flags remain false | `PFE-13-FREEZE-MANIFEST.json` | `ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs` | required | yes |
| Inventory | Customer 9 routes present | `PFE-13-ROUTE-INVENTORY.json` | `ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs` | required | yes |
| Inventory | Operator 13 routes present | `PFE-13-ROUTE-INVENTORY.json` | `ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs` | required | yes |
| Inventory | Admin 7 routes present | `PFE-13-ROUTE-INVENTORY.json` | `ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs` | required | yes |
| Inventory | Supporting surfaces present | `PFE-13-ROUTE-INVENTORY.json` | `ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs` | required | yes |
| PFE-6 | accessibility baseline present | `PFE-6-ACCESSIBILITY-KEYBOARD-COMPLIANCE.md` | static existence check | required | yes |
| PFE-7 | responsive baseline present | `PFE-7-RESPONSIVE-VIEWPORT-COMPLETION.md` | static existence check | required | yes |
| PFE-8 | state baseline present | `PFE-8-EMPTY-LOADING-ERROR-STATE-COMPLETION.md` | static existence check | required | yes |
| PFE-9 | screenshot manifest present | `PFE-9-SCREENSHOT-MANIFEST.json` | static existence check | required | yes |
| PFE-10 | bundle budget present | `PFE-10-BUNDLE-BUDGET.json` | static existence check | required | yes |
| PFE-10 | bundle checker available | `CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs` | static existence check | required | yes |
| PFE-11 | copy / i18n gate available | `ACCEPTANCE_PFE_11_PRODUCT_COPY_I18N_COMPLETION.cjs` | static existence check | required | yes |
| PFE-12 | demo manifest present | `PFE-12-DEMO-MANIFEST.json` | static existence check | required | yes |
| PFE-12 | RC gate available | `ACCEPTANCE_PFE_12_DEMO_MODE_RELEASE_CANDIDATE.cjs` | static existence check | required | yes |
| Scope | route topology unchanged | changed file guard | `ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs` | required | yes |
| Scope | package files unchanged | changed file guard | `ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs` | required | yes |
| Scope | backend, fixture, and contract files unchanged | changed file guard | `ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs` | required | yes |
| Scope | web runtime source unchanged | changed file guard | `ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs` | required | yes |
| Scope | dist and audit image artifacts absent | changed file guard | `ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs` | required | yes |
| Policy | post-freeze change policy present | `PFE-13-FREEZE-MANIFEST.json` | `ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs` | required | yes |

## Local review commands

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs
pnpm run build:web
node scripts/frontend_acceptance/CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs
pnpm run typecheck:web
node scripts/frontend_acceptance/ACCEPTANCE_PFE_12_DEMO_MODE_RELEASE_CANDIDATE.cjs
node scripts/frontend_acceptance/ACCEPTANCE_PFE_11_PRODUCT_COPY_I18N_COMPLETION.cjs
git status --short
```
