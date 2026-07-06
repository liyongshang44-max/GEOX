<!-- docs/frontend-productization/PFE-7-RESPONSIVE-ISSUE-REGISTER.md -->
# PFE-7 Responsive Issue Register

## 0. Register policy

This register records known non-blocking responsive gaps after the PFE-7 baseline. A severe issue cannot be listed as non-blocking if it causes page-level horizontal overflow at 390, unreachable navigation, clipped primary content, unusable tables with no scroll, broken export route, or hidden focus ring.

## 1. Issues

| issue id | surface | viewport | severity | reason not fixed in PFE-7 | later phase owner |
|---|---|---|---|---|---|
| PFE7-RSP-001 | All formal surfaces | 1440 / 1280 / 1024 / 768 / 390 | medium | PFE-7 establishes CSS and route walkthrough baseline but does not create screenshot or visual-regression baselines. | PFE-8 / PFE-9 |
| PFE7-RSP-002 | Export / print surfaces | 768 / 390 / print | low | Browser print dialog and physical printer constraints are outside app layout control. Screen layout and reportPrint media remain preserved. | PFE-9 |
| PFE7-RSP-003 | Operator Field Runtime route-link tabs | 390 | low | Tabs remain semantic route links and stack/wrap. Full custom compact tab UX is deferred to avoid changing route semantics. | PFE-9 |
| PFE7-RSP-004 | Large trace/hash payload strings | 390 | low | Long tokens wrap with `overflow-wrap:anywhere`; pixel-level typography tuning is deferred. | PFE-9 |
| PFE7-RSP-005 | Admin side navigation visual polish | 768 / 390 | low | Admin nav remains reachable and stacks; native mobile navigation redesign is outside PFE-7. | PFE-12 |

## 2. Non-blocking rationale

The issues above do not block PFE-7 because navigation remains reachable, ProductPageShell stacks main and aside, tables have local overflow regions, side rails stack, long ids wrap, export/print CSS is preserved, accessibility focus styling remains imported, route topology is unchanged, and package/dependency files are unchanged.
