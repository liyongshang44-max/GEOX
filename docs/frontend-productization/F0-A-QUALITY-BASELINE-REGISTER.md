<!-- docs/frontend-productization/F0-A-QUALITY-BASELINE-REGISTER.md -->
# F0-A Quality Baseline Register

## Purpose

Quality Baseline Register records the frontend quality surface that must be covered after F0-A.

F0-A does not fix quality issues. F0-A only records the F2 coverage baseline.

## Required quality surfaces

F2 must cover these quality surfaces:

```text
Accessibility baseline
Responsive viewport smoke
Keyboard / focus gate
Empty / loading / error state coverage
Visual screenshot checklist
Performance budget
```

## Accessibility baseline

```text
Current status: not fully hardened
Future task: F2-A Accessibility Baseline
Scope: Operator / Customer / Admin formal surfaces
Must cover: landmarks, aria labels, nav active state, focus visible, heading order, button/link semantics
```

## Responsive viewport smoke

```text
Current status: partially covered by CSS hardening, not full smoke baseline
Future task: F2-B Responsive Viewport Smoke
Scope: desktop / tablet / narrow viewport checks
Must cover: shell layout, sidebar behavior, wrapping tables, cards, meta rows
```

## Keyboard / focus gate

```text
Current status: not explicitly frozen
Future task: F2-C Keyboard / Focus Gate
Must cover: nav keyboard reachability, focus visible, disabled nav semantics, form controls
```

## Empty / loading / error state coverage

```text
Current status: mixed by surface
Future task: F2-D Empty / Loading / Error State Register
Must cover: no spinner-only indefinite state, no fake data, no production outage claim, no unhandled read model failure
```

## Visual screenshot checklist

```text
Current status: not formalized
Future task: F2-E Visual Screenshot Checklist
Must cover: key route screenshots or equivalent manual capture protocol
```

## Performance budget

```text
Current status: build passes, but explicit frontend performance budget is not frozen
Future task: F2-F Performance Budget
Must cover: build size, route chunk awareness, no accidental heavyweight dependency, no eager import of all formal surfaces
```

## Quality nonclaims

F0-A does not claim accessibility hardening is complete.
F0-A does not claim responsive viewport smoke is complete.
F0-A does not claim keyboard / focus gate is complete.
F0-A does not claim empty / loading / error state coverage is complete.
F0-A does not claim visual screenshot checklist is complete.
F0-A does not claim frontend performance budget is frozen.
