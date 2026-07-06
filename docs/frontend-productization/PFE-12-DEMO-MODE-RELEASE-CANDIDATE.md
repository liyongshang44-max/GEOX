<!-- docs/frontend-productization/PFE-12-DEMO-MODE-RELEASE-CANDIDATE.md -->
# PFE-12 Demo Mode & Release Candidate

## 0. Phase

PFE-12 Demo Mode & Release Candidate.

PFE-12 establishes a demo-safe release-candidate baseline for Formal Product Frontend v1. It is not a production launch or a new capability phase.

## 1. Goal

PFE-12 packages the completed Formal Product Frontend work into a reviewable demo-mode and release-candidate state with explicit nonclaims, seed policy, demo script, RC checklist, and static acceptance gate.

## 2. Completion statement

Formal Product Frontend v1 has a demo-mode and release-candidate baseline.

Chinese completion statement:

```text
正式产品前端 v1 已经建立演示模式与发布候选版基线。
```

## 3. Source baseline

PFE-12 follows PFE-3 through PFE-11 and does not redo those phases. Its direct evidence chain is:

```text
PFE-6 accessibility baseline
PFE-7 responsive baseline
PFE-8 state baseline
PFE-9 screenshot baseline
PFE-10 bundle budget baseline
PFE-11 copy / i18n baseline
```

## 4. Covered surfaces

PFE-12 covers the existing formal product frontend surfaces:

```text
Customer 9 routes
Operator 13 routes
Admin 7 routes
/login
LocaleToggle
Product state primitives
PFE-9 screenshot manifest and capture script
PFE-10 bundle budget checker
PFE-11 copy / i18n gate
controlled pilot demo seed dry-run
release candidate checklist
```

## 5. Demo mode policy

Demo mode is review-safe. It must use demo, replay-backed, or review-only language and must not imply a production or execution state.

Demo mode requires:

```text
Customer report-only boundary
Operator read-only review boundary
Admin governance readback boundary
default seed dry-run
manual apply only with explicit tenant
no route topology change
no new backend write path
```

## 6. Release candidate policy

RC means the frontend is ready for review as a candidate artifact. It does not mean production release, commercial release, operational certification, or field deployment.

RC requires documented evidence for accessibility, responsive behavior, explicit states, screenshot manifest, bundle budget, copy / i18n, demo seed dry-run, and release checklist.

## 7. Demo seed policy

The frontend demo seed default command is dry-run:

```powershell
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FRONTEND_DEMO_V1.cjs --dry-run
```

Manual apply remains outside default PFE-12 acceptance and requires an explicit tenant:

```powershell
node scripts/demo_seed/SEED_CONTROLLED_PILOT_FRONTEND_DEMO_V1.cjs --apply --tenant tenantA
```

## 8. Demo boundary policy

The PFE-12 demo manifest is the source of truth for demo flags. The static gate requires every production/live/execution flag in that manifest to remain false.

## 9. Allowed files

```text
docs/frontend-productization/PFE-12-DEMO-MODE-RELEASE-CANDIDATE.md
docs/frontend-productization/PFE-12-DEMO-MANIFEST.json
docs/frontend-productization/PFE-12-RC-CHECKLIST.md
docs/frontend-productization/PFE-12-DEMO-SCRIPT.md
docs/frontend-productization/PFE-12-RC-ISSUE-REGISTER.md
scripts/frontend_acceptance/ACCEPTANCE_PFE_12_DEMO_MODE_RELEASE_CANDIDATE.cjs
```

## 10. Forbidden files

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
apps/web/dist/*
docs/audit/*.png
docs/audit/**/*.png
apps/web/src/app/App.tsx
apps/web/src/app/AppShell.tsx
apps/web/src/features/*
apps/web/src/layouts/*
apps/web/src/styles/*
```

## 11. Acceptance policy

PFE-12 acceptance is static. It does not start DB, does not start web, does not write facts, and does not require dist. It validates the demo manifest, seed policy, RC checklist, demo script, issue register, PFE-6 through PFE-11 evidence docs, and change scope.

## 12. Nonclaims

PFE-12 can claim a demo-safe release-candidate baseline only. It cannot claim production launch, commercial launch, live field operation, or customer rollout.

## 13. Handoff

The RC handoff consists of the PFE-12 demo manifest, RC checklist, demo script, issue register, static acceptance output, GitHub CI success, local dry-run seed output, and PFE-10 bundle checker output.
