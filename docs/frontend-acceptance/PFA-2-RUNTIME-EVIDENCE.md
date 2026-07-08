<!-- docs/frontend-acceptance/PFA-2-RUNTIME-EVIDENCE.md -->
# PFA-2 Runtime Evidence

## Final runtime status

```text
phase: PFA-2 Locale Contract Completion
status: PASS
validated runtime-source head: a59b1c9ea66206d86c34855fb9e0e2a411c46d7c
matrix promotion head: f4d8427668e871cad61f10b3ece76d1174819f2e
current matrix state: runtime-pass
actual routes: 30
locales: 2
route renders: 60
viewport: 1440 x 1100
```

The strengthened runtime audit passed on the exact runtime-source head above. The matrix promotion commit changed only `docs/frontend-acceptance/PFA-2-ROUTE-LOCALE-MATRIX.json`; it did not modify runtime source, route behavior, localization copy, audit logic, backend code, fixtures, or package dependencies.

## Strengthened proof

```text
static acceptance exit: 0
runtime audit exit: 0
route health: 60/60
html lang: 60/60
locale pairs: 30/30
locale pair differentiation: 30/30
role-boundary equivalence and mandatory presence: 30/30
pathname equivalence: 30/30
RuntimeTextGuard dependency: 0
matrix records at runtime-pass: 30/30
worktree after generated-report cleanup: clean
```

The runtime audit covered complete visible product text, forbidden locale markers, localized attributes, route-path equivalence, locale differentiation, and mandatory Operator safety capabilities. Locale-neutral treatment is limited to technical identifiers, canonical paths, hashes, source references, and source-owned business values explicitly marked at their render boundary.

## CI evidence

```text
runtime-source CI run: #4247
runtime-source CI conclusion: success
build-test: success
frontend runtime page audit: success
full acceptance: success
matrix-promotion CI run: #4248
matrix-promotion build-test: success
matrix-promotion acceptance: pending at evidence-write time
```

The PR remains Draft until the final closure-only documentation head receives synchronized CI success. That readiness gate does not invalidate the completed runtime proof.

## Scope boundaries preserved

```text
no backend change
no route or API-base change
no authentication-contract change
no migration, fixture, package, or workflow change
no RuntimeTextGuard replacement dependency
no production device, gateway, dispatch, or execution claim
PFA-3 responsive/layout work remains deferred
```

The only responsive-file change replaces a locale-dependent English ARIA selector with a stable class while preserving the existing breakpoint and layout declarations.