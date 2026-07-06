<!-- docs/frontend-productization/PFE-13-FRONTEND-PRODUCT-V1-FREEZE.md -->
# PFE-13 Frontend Product v1 Freeze

## 0. Phase

PFE-13 Frontend Product v1 Freeze.

PFE-13 freezes Formal Product Frontend v1 as a governed, reviewable, regression-ready frontend product baseline. It is not a launch phase and not a repair phase.

## 1. Goal

PFE-13 closes the PFE productization line by recording the frozen route inventory, freeze manifest, freeze checklist, frozen issue register, post-freeze change policy, and static freeze acceptance gate.

## 2. Completion statement

Formal Product Frontend v1 is frozen as a governed, reviewable frontend product baseline.

Chinese completion statement:

```text
正式产品前端 v1 已冻结为一个受治理、可审查、可回归的前端产品基线。
```

## 3. Source baseline

The frozen baseline follows the PFE chain:

```text
PFE-3 Customer Portal Productization
PFE-4 Operator Runtime Console Productization
PFE-5 Admin Console Productization
PFE-6 Accessibility & Keyboard Compliance
PFE-7 Responsive / Viewport Completion
PFE-8 Empty / Loading / Error State Completion
PFE-9 Visual Regression & Screenshot Baseline
PFE-10 Performance Budget & Bundle Hygiene
PFE-11 Product Copy / i18n Completion
PFE-12 Demo Mode & Release Candidate
```

## 4. Frozen surfaces

PFE-13 freezes:

```text
Customer 9 routes
Operator 13 routes
Admin 7 routes
/login
LocaleToggle
Product design-system primitives
Product state primitives
ProductDataTable
ProductPageShell / ProductPageHeader
PFE-9 screenshot manifest
PFE-10 bundle budget
PFE-11 copy / i18n baseline
PFE-12 demo mode / RC manifest
```

The machine-readable route inventory is recorded in `PFE-13-ROUTE-INVENTORY.json`. `PFE-13-FORMAL-SURFACES.md` is a pointer to that inventory.

## 5. Freeze meaning

Freeze means the Formal Product Frontend v1 baseline is stable for review, regression, handoff, and governed future change. It does not mean production launch, commercial launch, real device connection, field pilot start, or AO-ACT dispatch enablement.

## 6. Non-goals

PFE-13 does not add routes, remove routes, change route topology, add product capability, change backend behavior, change migrations, change contracts, change fixtures, change package files, add dependencies, change CI workflows, change Customer / Operator / Admin pages, change styles, modify App or AppShell, submit dist, submit screenshots, execute seed apply, start DB, start web, or write facts.

## 7. Allowed files

```text
docs/frontend-productization/PFE-13-FRONTEND-PRODUCT-V1-FREEZE.md
docs/frontend-productization/PFE-13-FREEZE-MANIFEST.json
docs/frontend-productization/PFE-13-ROUTE-INVENTORY.json
docs/frontend-productization/PFE-13-FORMAL-SURFACES.md
docs/frontend-productization/PFE-13-FREEZE-CHECKLIST.md
docs/frontend-productization/PFE-13-FROZEN-ISSUE-REGISTER.md
scripts/frontend_acceptance/ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs
```

## 8. Forbidden files

```text
apps/server/*
migrations/*
packages/contracts/*
fixtures/*
.github/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
apps/web/package.json
apps/web/src/app/routes/*
apps/web/src/app/App.tsx
apps/web/src/app/AppShell.tsx
apps/web/src/features/*
apps/web/src/layouts/*
apps/web/src/styles/*
apps/web/src/design-system/*
apps/web/dist/*
docs/audit/*.png
docs/audit/**/*.png
```

## 9. Post-freeze change policy

After this freeze:

```text
route changes require a new phase
capability changes require a new phase
backend changes are outside this freeze line
package changes are outside this freeze line
visual changes require regression evidence
copy changes require i18n gate evidence
bundle changes require budget check evidence
```

## 10. Acceptance policy

PFE-13 acceptance is static. It does not start DB, start web, write facts, or require dist. It validates the freeze manifest, route inventory, checklist, issue register, baseline chain, and change scope.

## 11. Nonclaims

PFE-13 can claim a frozen governed frontend product baseline only. It cannot claim production launch, commercial launch, live field operation, real customer deployment, complete digital twin runtime, production monitoring, security certification, or all future product work.

## 12. Handoff statement

The frozen handoff consists of the PFE-13 freeze manifest, route inventory, freeze checklist, frozen issue register, post-freeze change policy, static acceptance output, GitHub CI success, PFE-12 RC evidence, PFE-11 copy evidence, and PFE-10 bundle budget evidence.
