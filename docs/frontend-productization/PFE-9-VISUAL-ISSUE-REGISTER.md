<!-- docs/frontend-productization/PFE-9-VISUAL-ISSUE-REGISTER.md -->
# PFE-9 Visual Issue Register

## 0. Register policy

This register records non-blocking visual-review gaps after PFE-9. It cannot be used to waive blank screenshots, visible route runtime failures, persistent loading, page-level horizontal overflow, missing primary navigation, clipped main content, missing headings, unsafe role copy, hidden focus indication, or missing export/print safe content.

## 1. Non-blocking issues

| issue id | surface | viewport | severity | reason not fixed in PFE-9 | later owner |
|---|---|---|---|---|---|
| PFE9-VIS-001 | All formal surfaces | all | medium | PFE-9 v1 defines review-safe screenshot manifest and artifacts, not strict pixel diff. | PFE-9-B |
| PFE9-VIS-002 | All formal surfaces | all | medium | Full browser matrix remains out of scope for PFE-9 v1. | PFE-10 |
| PFE9-VIS-003 | All formal surfaces | all | medium | Full device matrix remains out of scope for PFE-9 v1. | PFE-10 |
| PFE9-VIS-004 | Export / print surfaces | all | low | Browser print dialog behavior is outside app screenshot control. | PFE-10 |
| PFE9-VIS-005 | Mobile navigation | mobileNarrow | medium | PFE-9 captures narrow viewport screenshots but does not redesign mobile navigation. | PFE-10 |

## 2. Blocking issues not allowed

The following must not be accepted as non-blocking:

```text
blank screenshot
visible route runtime failure
persistent loading state
page-level horizontal overflow
primary navigation missing
main content clipped
page heading missing
unsafe role-specific copy
missing export or print-safe content
hidden focus indication in focus samples
```

## 3. Completion note

PFE-9 v1 is complete when the screenshot manifest, review matrix, capture script, issue register, and static acceptance gate are in place, and existing CI runtime audit remains green.
