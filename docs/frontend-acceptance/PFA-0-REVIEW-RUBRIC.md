<!-- docs/frontend-acceptance/PFA-0-REVIEW-RUBRIC.md -->
# PFA-0 Review Rubric

## Purpose

PFA-0 reviews whether the PFE-13 frozen frontend pages are readable, demonstrable, and suitable for product-page handoff. It does not fix pages.

## Review dimensions

Each route is reviewed across these dimensions:

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

## Severity scale

### P0

Blocking page failure or unsafe role claim.

Examples:

```text
blank page
404 / 500
permanent loading
main navigation missing
customer page exposes internal execution concepts
operator page claims enabled execution
admin page claims service operation
```

### P1

Product demo blocker. The page can load, but is not suitable for formal product demonstration.

Examples:

```text
core demo page unreadable
severe table layout failure
large mixed-language residue in zh-CN mode
reports center too dense for demonstration
operator detail page unusable because of nested horizontal scrolling
core demo data dominated by unnamed labels or empty summaries
```

### P2

Product quality issue that should enter PFA-1 or PFA-2.

Examples:

```text
small mixed-language residue
field names wrap badly
badge wraps to multiple lines
long IDs lack display labels
layout wastes large empty areas
local table density is high but still usable
```

### P3

Minor polish.

Examples:

```text
spacing refinement
copy tone refinement
low-frequency visual awkwardness
non-demo route polish
```

## Completion meaning

PFA-0 completion means page issues are reviewed and classified. It does not mean page issues are fixed.
