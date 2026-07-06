<!-- docs/frontend-acceptance/PFA-0-PAGE-QUALITY-AUDIT.md -->
# PFA-0 Page Quality Audit

## 0. Phase

PFA-0 Page Quality Audit.

PFA means Product Frontend Acceptance. PFA-0 is a post-freeze review layer for the PFE-13 frozen frontend baseline. It is not a repair PR, not a new productization phase, and not Twin Runtime work.

## 1. Goal

PFA-0 reviews the PFE-13 frozen frontend inventory for product-page quality: route health, boundary safety, role separation, i18n consistency, visual hierarchy, table readability, dense content handling, demo data quality, responsive sanity, and demo readiness.

## 2. Source of truth

The audit object is the PFE-13 inventory:

```text
docs/frontend-productization/PFE-13-ROUTE-INVENTORY.json
```

The PFA-0 review manifest is:

```text
docs/frontend-acceptance/PFA-0-REVIEW-MANIFEST.json
```

The route-level records are:

```text
docs/frontend-acceptance/PFA-0-ROUTE-REVIEW-MATRIX.json
```

## 3. Completion statement

All PFE-13 frozen frontend surfaces have been audited for product-page quality, and P1/P2 remediation work is classified for PFA-1.

Chinese completion statement:

```text
所有 PFE-13 冻结的正式前端页面已经完成产品页面质量审计，并已将 P1/P2 修复项归类到 PFA-1。
```

## 4. Nonclaims

PFA-0 cannot claim:

```text
page issues are fixed
all pages are product-grade complete
Twin Runtime can begin
field pilot can begin
production-ready state
```

PFA-0 does not fix pages. It records the gap between engineering freeze and product-page acceptance.

## 5. Coverage

PFA-0 covers:

```text
Customer 9
Operator 13
Admin 7
Supporting surfaces
```

Parameterized routes use concrete demo bindings from the manifest:

```text
:fieldId -> field_c8_demo
:operationId -> op_plan_c8_irrigation_formal_001
```

## 6. Review dimensions

Every route record is reviewed across:

```text
routeHealth
boundarySafety
roleSeparation
i18nConsistency
visualHierarchy
tableReadability
denseContentHandling
demoDataQuality
responsiveSanity
demoReadiness
```

## 7. Initial findings

The seeded issue register records the observed screenshot findings:

```text
Customer zh-CN English residue
Customer unnamed demo data
Customer reports center density
Customer long IDs and wrapped badges
Operator source inventory readability
Operator field runtime detail density
Operator pilot readiness readability
Operator field runtime layout width
Admin table field wrapping
Admin mixed terminology residue
```

These are not PFA-0 blockers. They are PFA-1 inputs.

## 8. Acceptance policy

PFA-0 acceptance is static. It does not start DB, start web, capture screenshots, write facts, execute seed apply, change routes, or edit runtime source. It validates the review framework, manifest, route matrix, issue register, rubric, capture script, and scope boundaries.

## 9. Artifact policy

The screenshot capture script writes generated artifacts only when run manually against a live local frontend:

```text
docs/audit/pfa-0-screenshots
docs/audit/PFA_0_PAGE_REVIEW_REPORT.md
```

Generated PNG artifacts and generated audit reports must not be committed by default.

## 10. PFA-1 handoff

PFA-1 must use the PFA-0 matrix and issue register as its input. PFA-1 should not freely invent unrelated page work.

Priority order:

```text
Operator P1 table and runtime readability
Customer reports center density
zh-CN English residue
Demo data display labels and summary fallback
Admin table wrapping polish
```

P1 issues block Twin Runtime work until they are remediated or reclassified.
