<!-- docs/frontend-productization/PFE-8-STATE-ISSUE-REGISTER.md -->
# PFE-8 State Issue Register

## 0. Register policy

This register records non-blocking state-expression gaps after PFE-8. A severe state issue cannot remain non-blocking if it causes a blank formal route, permanent loading, raw diagnostic text, missing error state on an async route, missing empty state on a list route, or state copy that suggests a forbidden action.

## 1. Non-blocking issues

| issue id | surface | state kind | severity | reason not fixed in PFE-8 | later owner |
|---|---|---|---|---|---|
| PFE8-STATE-001 | All formal surfaces | visual state polish | medium | PFE-8 completes semantic and copy baselines but does not establish screenshot or visual-regression baselines. | PFE-9 |
| PFE8-STATE-002 | Export / print surfaces | print dialog state | low | Browser print dialog behavior is outside app state control. Return and print controls remain explicit. | PFE-9 |
| PFE8-STATE-003 | Operator readback pages | recovery workflow | medium | PFE-8 states explain unavailable or degraded readback; recovery workflows are not implemented in this phase. | PFE-12 |
| PFE8-STATE-004 | Admin readback pages | service operation state | medium | PFE-8 keeps Admin as governance readback and does not add service operation controls. | PFE-12 |
| PFE8-STATE-005 | Login | full auth screen-reader matrix | medium | Login state copy and semantics are covered; a full browser/screen-reader matrix remains deferred. | PFE-9 |

## 2. Blocking issues not allowed

The following cannot be accepted as non-blocking:

```text
blank formal product route
permanent loading on a formal route
raw diagnostic text visible on a formal route
private payload or implementation output visible on a formal route
missing safe error state on an async route
missing empty state on a list route
state copy that suggests a forbidden mutation or control action
unreachable safe return or retry action when one is displayed
```

## 3. Non-blocking rationale

PFE-8 completes state semantics and role-safe copy without changing routes, backend behavior, contracts, fixtures, packages, CI workflow, or product capability. Remaining issues are polish, screen-reader matrix, visual-regression, or future recovery-workflow work.
