# F2 Keyboard Focus Gate

## Phase

F2-C Keyboard / Focus / Interaction Gate.

## Purpose

Formal navigation, locale toggle, topbar actions, report entries, export links, field/operation card links, and disabled placeholders must be keyboard reachable or explicitly unavailable.

## Scope

Covered targets: Customer nav, Operator nav, Admin nav, LocaleToggle, topbar actions, formal report links, export links, field/operation card links, and disabled nav items.

## Required proof points

F2-C must prove LocaleToggle keyboard accessible, formal nav keyboard accessible, topbar actions keyboard accessible, focus visible, and disabled nav items are not focus traps.

## LocaleToggle keyboard accessible

LocaleToggle uses button semantics and must remain reachable by keyboard. It must expose an accessible label and active pressed state.

## Formal nav keyboard accessible

Formal nav must use link semantics for reachable destinations. Disabled nav placeholders must expose disabled semantics and must not create focus traps.

## Topbar actions keyboard accessible

Topbar actions such as locale switch, report/export links, and read-only action buttons must use link or button semantics. They must not rely on pointer-only handlers.

## Focus visible

The frontend must retain visible focus behavior. The static baseline checks for focus-visible support and blocks global focus rules that remove visible indicators.

Acceptable replacement indicators include outline, box-shadow, or a comparably visible focus indicator.

## Keyboard reachability

Navigation must use link semantics. LocaleToggle uses button semantics. Formal cards that navigate should use anchor or link semantics. Disabled nav placeholders must be skipped or marked with disabled semantics.

## Interaction no-op clarity

Disabled controls must expose disabled semantics and visible unavailable or coming-soon copy. A control must not appear active while doing nothing.

## Acceptance hooks

The F2 acceptance gate checks focus support, blocked outline removal patterns, obvious fake interaction patterns, topbar action coverage, and disabled placeholder semantics.

## Non-goals

No browser automation. No mouse/keyboard lab certification. No new package dependency.
