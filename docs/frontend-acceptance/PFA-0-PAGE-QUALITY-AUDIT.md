<!-- docs/frontend-acceptance/PFA-0-PAGE-QUALITY-AUDIT.md -->
# PFA-0 Page Quality Audit

## 0. Phase

PFA-0 is the post-freeze Product Frontend Acceptance review for the PFE-13 route inventory. It is an evidence and classification phase, not a page-repair phase and not Twin Runtime work.

## 1. Goal

PFA-0 records route health, boundary safety, role separation, i18n consistency, visual hierarchy, table readability, dense-content handling, demo-data quality, responsive sanity, and demo readiness.

The governing distinction is:

```text
runtime capture PASS != page-quality PASS
```

## 2. Sources of truth

```text
docs/frontend-productization/PFE-13-ROUTE-INVENTORY.json
docs/frontend-acceptance/PFA-0-REVIEW-MANIFEST.json
docs/frontend-acceptance/PFA-0-ROUTE-REVIEW-MATRIX.json
docs/frontend-acceptance/PFA-0-ISSUE-REGISTER.md
docs/frontend-acceptance/PFA-POST-FREEZE-TASK-LINE.md
```

## 3. Full runtime evidence

The successful full capture used the PFA-1 API-base prerequisite at commit `24c6f9a8803c9738ce0311c35deda5ddfc056dae` and the PFA-0 capture framework from `a7809b92b0673b69a96d61d373a7a5da3a86e503`.

```text
30 actual routes
2 locales: zh-CN, en-US
3 viewports: desktopReview, laptopReview, mobileSpotCheck
180 screenshots
runtime result: 180/180 PASS
```

This proves authenticated access, successful `auth/me`, non-placeholder rendering, and screenshot generation. It does not prove locale correctness, responsive correctness, information hierarchy, report readability, or demo readiness.

Generated screenshots and reports remain local and must not be committed.

## 4. Page-quality result

```text
Runtime API-base fix: PASS
Authenticated full capture: PASS
Page-quality audit: FAIL with open P1/P2 findings
```

Observed P1 classes:

```text
mixed and incomplete zh-CN/en-US output
mobile and selected desktop document-width overflow
unreadable mobile export layouts
extreme page density and scroll depth
Customer Dashboard duplication and layout imbalance
Operator table/detail/pilot readability failures
```

Observed P2 classes:

```text
desktop navigation repeated in the mobile shell
weak demo labels and unnamed entities
long ID and badge wrapping
admin table wrapping
underused layout width
```

## 5. Coverage

```text
Customer: 9 routes
Operator: 13 routes
Admin: 7 routes
Supporting: login and shared product components
```

Parameterized bindings:

```text
:fieldId -> field_c8_demo
:operationId -> op_plan_c8_irrigation_formal_001
```

All 30 actual routes were captured in both locales at all three viewports.

## 6. Capture-gap reconciliation

```text
PFA0-CAP-001 resolved: all parameterized routes were captured
PFA0-CAP-002 resolved: all authenticated Admin routes were captured
```

Resolving capture gaps does not resolve the page-quality findings exposed by the screenshots.

## 7. Revised PFA task line

```text
PFA-0 Evidence Reconciliation
PFA-1 Runtime API-Base and Capture Enablement
PFA-2 Locale Contract Completion
PFA-3 Responsive Shell and Overflow Containment
PFA-4 Export and Print Surface Strategy
PFA-5 Information Architecture and Density Remediation
PFA-6 Table, Label, and Demo-Data Polish
PFA-7 Full Recapture and Closure Gate
```

Detailed boundaries and acceptance criteria are frozen in `PFA-POST-FREEZE-TASK-LINE.md`.

## 8. Acceptance policy

PFA-0 static acceptance validates the framework, manifest, matrix, issue register, task line, rubric, capture script, and scope boundary. PFA-0 does not change page source, routes, backend behavior, package configuration, or generated artifacts.

## 9. Completion statement

```text
All PFE-13 formal frontend routes have route-level PFA-0 records and complete authenticated runtime screenshot evidence. Runtime capture is complete, but page quality is not accepted. Open P1/P2 findings are assigned to PFA-2 through PFA-6, and PFA-7 is the final recapture and closure gate.
```

```text
所有 PFE-13 正式前端路由已经建立 PFA-0 路由级审计记录，并完成认证后的全量运行截图；运行捕获已经完成，但页面质量尚未通过。现存 P1/P2 问题已分配到 PFA-2 至 PFA-6，PFA-7 用于最终全量复验与收口。
```

## 10. Forbidden claims

PFA-0 must not claim:

```text
page issues are fixed
all pages are product-grade complete
180/180 runtime PASS means page-quality PASS
Twin Runtime can begin
field pilot can begin
production-ready state
```

Open P1 findings block subsequent runtime-kernel work until remediated or explicitly reclassified with evidence.