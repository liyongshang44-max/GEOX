# P-UI-VISUAL — Final Page Visual Closure

## Purpose

Close the gap between automated frontend checks and human screenshot review.

## Scope

Single UI closure PR.

This task only adjusts page labels, visible wording, and visual acceptance checks.

## Acceptance commands

```powershell
node scripts/qa/P_UI_VISUAL_CLOSURE_CHECK.cjs
pnpm run typecheck:web
pnpm run ci:frontend:runtime-page-audit
```

Human review must inspect the generated screenshots again.
