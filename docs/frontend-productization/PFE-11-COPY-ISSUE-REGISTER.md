<!-- docs/frontend-productization/PFE-11-COPY-ISSUE-REGISTER.md -->
# PFE-11 Copy Issue Register

## 0. Register policy

This register records non-blocking copy and i18n gaps after PFE-11. It cannot waive role-boundary leaks, missing zh-CN / en-US shell copy, inaccessible LocaleToggle, missing state copy coverage, RuntimeTextGuard replacement growth without explanation, package changes, route changes, backend changes, fixture changes, CI workflow changes, runtime audit failure, or PFE-10 bundle-budget failure.

## 1. Non-blocking issues

| issue id | surface / component | severity | reason not fixed in PFE-11 | later owner |
|---|---|---|---|---|
| PFE11-COPY-001 | Formal pages | medium | Full extraction of every page-local string into a copy catalog is deferred. PFE-11 establishes ownership, matrix coverage, and scoped gates first. | PFE-12 |
| PFE11-COPY-002 | Product primitives | low | Primitives receive copy through props. A full primitive-level copy catalog is unnecessary for v1. | PFE-12 |
| PFE11-COPY-003 | Date / number / currency formatting | medium | Locale-aware formatting is outside PFE-11 v1. | PFE-12 |
| PFE11-COPY-004 | Translation review | medium | Native-speaker translation review is not part of this engineering baseline. | PFE-12 |
| PFE11-COPY-005 | Legacy and dev routes | low | PFE-11 covers formal product surfaces. Legacy and dev-only routes stay outside this phase. | PFE-12 |
| PFE11-COPY-006 | RuntimeTextGuard replacement retirement | medium | RuntimeTextGuard remains as fallback. PFE-11 freezes growth but does not remove existing entries. | PFE-12 |

## 2. Blocking issues not allowed

The following must not be accepted as non-blocking:

```text
Customer internal code visible
raw backend status visible
English-only formal shell copy
Chinese-only formal shell copy
LocaleToggle inaccessible
missing en-US for formal navigation or page title
missing zh-CN for formal navigation or page title
missing formal state copy coverage
RuntimeTextGuard replacement count increased without this register being updated
hardcoded role-unsafe action claim
state copy leaks raw error detail
package or lockfile changed
route topology changed
backend, contract, fixture, or CI workflow changed
runtime audit failed
PFE-10 bundle budget failed
```

## 3. RuntimeTextGuard policy

Current PFE-11 baseline replacement count:

```text
8
```

A future increase requires a new issue-register row explaining why the source or copy catalog layer could not solve the problem first.

## 4. Future work policy

Future copy expansion should prefer source / view-model / catalog fixes. DOM text rewriting is fallback only.
