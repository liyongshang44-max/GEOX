<!-- docs/frontend-acceptance/PFA-3-RUNTIME-EVIDENCE.md -->
# PFA-3 Runtime Evidence

## Current status

```text
phase: PFA-3 Responsive Shell and Overflow Containment
status: IMPLEMENTATION IN PROGRESS
matrix hard routes: 27
matrix exports: 3
formal locales: 2
formal viewports: 3
hard route renders expected: 162
export smoke renders expected: 6
shell probes expected: 12
total browser cases expected: 180
```

## Required proof

```text
static acceptance exit: 0
runtime audit exit: 0
hard route health: 162/162
hard document containment: 162/162
hard html lang: 162/162
required selector containment: 162/162
export desktop smoke: 6/6
shell probes: 12/12
compact navigation interaction: 6/6 surface-locale suites
internal overflow regions: PASS
root overflow masking: 0
unexpected overflow offenders: 0
PFA-2 locale regression: PASS
typecheck: PASS
build: PASS
bundle: PASS
CI: PASS
worktree after report cleanup: clean
```

## Evidence policy

Generated screenshots and JSON reports remain local artifacts under `docs/audit/` and must not be committed. The final evidence document records exact source head, exact metrics, and synchronized closure-head CI only after actual execution.