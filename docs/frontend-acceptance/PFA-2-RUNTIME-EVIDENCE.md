<!-- docs/frontend-acceptance/PFA-2-RUNTIME-EVIDENCE.md -->
# PFA-2 Runtime Evidence

## Status

```text
phase: PFA-2 Locale Contract Completion
status: in progress
actual routes: 30
locales: 2
expected route renders: 60
viewport: 1440 x 1100
expected web port: 5184
```

Final evidence must record:

```text
real browser login
zh-CN and en-US auth/me proof
html lang 60/60
route health 60/60
required markers PASS
forbidden markers PASS
locale pair differentiation 30/30
role-boundary equivalence 30/30
RuntimeTextGuard dependency 0
generated artifacts excluded
```

No runtime claim is made until `AUDIT_PFA_2_RUNTIME_LOCALE_CONTRACT.cjs` completes successfully on the synchronized PR head.
