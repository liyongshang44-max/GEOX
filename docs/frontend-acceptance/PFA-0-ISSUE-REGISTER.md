<!-- docs/frontend-acceptance/PFA-0-ISSUE-REGISTER.md -->
# PFA-0 Issue Register

## Register policy

PFA-0 records page-quality issues observed after the PFE-13 freeze. It does not fix them. P1 issues must move to PFA-1 before Twin Runtime work begins.

## Seeded issues from manual screenshot review

| issue id | severity | surface | route area | issue | PFA-1 required |
|---|---|---|---|---|---|
| PFA0-CUS-001 | P1 | Customer | customer shell | zh-CN mode has visible English residue such as Summary, Available, Blocked, Report entries, and Export delivery. | yes |
| PFA0-CUS-002 | P2 | Customer | field and operation lists | Demo data shows many unnamed fields or operations. | yes |
| PFA0-CUS-003 | P1 | Customer | `/customer/reports` | Reports center is too dense for formal demonstration. | yes |
| PFA0-CUS-004 | P2 | Customer | fields and operations tables | Long IDs and wrapped badges reduce table readability. | yes |
| PFA0-OPR-001 | P1 | Operator | source inventory | Source inventory table has weak column readability and long reference overflow. | yes |
| PFA0-OPR-002 | P1 | Operator | field runtime detail | Field runtime detail content is compressed and horizontal scrolling is overused. | yes |
| PFA0-OPR-003 | P1 | Operator | pilot readiness | Pilot readiness cards and nested tables are hard to read. | yes |
| PFA0-OPR-004 | P2 | Operator | field runtime list | Main content is narrow while the right side is underused. | yes |
| PFA0-ADM-001 | P2 | Admin | admin tables | Some admin field names wrap awkwardly. | yes |
| PFA0-ADM-002 | P2 | Admin | admin shell | zh-CN mode still includes some English governance terminology. | yes |

## Non-blocking for PFA-0

PFA-0 may merge with P1/P2 issues recorded. That is the point of this review phase.

## Blocking for next phase

P1 issues block Twin Runtime work until PFA-1 has closed or explicitly reclassified them.

## Forbidden completion claim

PFA-0 must not claim page quality has been fixed or that all pages are product-grade complete.
