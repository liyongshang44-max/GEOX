<!-- docs/frontend-acceptance/PFA-3-OVERFLOW-EXCEPTION-REGISTER.md -->
# PFA-3 Overflow Exception Register

## Policy

Document-level horizontal overflow has no accepted exception on PFA-3 hard routes.

Internal horizontal scrolling is permitted only for semantic wide-data regions that satisfy all of the following:

```text
role="region"
aria-label is non-empty
tabIndex=0
data-horizontal-scroll-region="true"
data-overflow-owner is non-empty
region bounding box remains inside the viewport
no ancestor creates document-level overflow
```

## Registered internal regions

| exception id | owner | route scope | selector family | reason | expiry |
|---|---|---|---|---|---|
| PFA3-OV-001 | ProductDataTable | Customer, Admin, Operator Pilot | `[data-horizontal-scroll-region="true"]` | Semantic tables may retain readable minimum column widths. | PFA-7 review |
| PFA3-OV-002 | Operator Field Runtime | Evidence, Residual, Health, Audit | `.operatorFieldRuntime__*Table` wrapped by the shared region | Runtime review matrices must retain columns and evidence references. | PFA-7 review |
| PFA3-OV-003 | Operator Gateway Demo | Gateway Demo | replay-demo table regions wrapped by the shared region | Gateway source and standards matrices retain readable columns. | PFA-7 review |

## Explicitly forbidden exceptions

```text
html/body/#root overflow masking
product-shell overflow masking
unlabelled overflow-x:auto containers
focus-inaccessible scroll regions
removing columns or evidence references
character-level breaking of ordinary product copy
export/mobile behavior claimed complete by PFA-3
```

Any new internal overflow owner requires a register entry, matrix selector coverage, and runtime evidence.