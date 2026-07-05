<!-- docs/frontend-productization/F0-A-LOCALE-READINESS-REGISTER.md -->
# F0-A Locale Readiness Register

## Purpose

Locale Readiness Register records the current bilingual infrastructure, known bilingual copy gaps, translation boundary, and F1 scope seed.

F0-A does not repair locale support.

## Existing facts

```text
Locale skeleton exists.
LocaleProvider exists.
LocaleCode supports zh-CN and en-US.
Locale storage key is geox.locale.
useLocale exists.
text(zh, en) helper exists.
App root is already wrapped by LocaleProvider.
```

These facts describe infrastructure presence only. They do not mean bilingual product support is complete.

## Current gaps

```text
Language toggle is not established as a formal shell control.
OperatorLayout is not fully bilingual.
CustomerLayout is not fully bilingual.
AdminLayout is not fully bilingual.
Field Runtime copy is not fully bilingual.
Replay Demo copy is not fully bilingual.
Pilot Readiness copy is not fully bilingual.
Customer formal pages are not fully bilingual.
Admin formal pages are not fully bilingual.
Some old components use useLocale partially.
Some static Chinese copy remains outside locale helpers.
```

## F1 scope seed

```text
F1-A Locale Infrastructure Hardening
F1-B Shell / Navigation Bilingual Integration
F1-C Operator Formal Surface Bilingualization
F1-D Customer / Admin Formal Surface Bilingualization
```

F1-A must come before shell and page bilingualization.

## Translation Boundary

### Do translate

```text
formal nav labels
shell title
shell subtitle
boundary copy
nonclaim copy
empty state copy
loading state copy
error state copy
static product surface labels
static helper text
```

### Do not translate

```text
fact_id
field_id
source_ref
evidence_ref
raw_payload
contract kind
route path
API field name
audit hash
determinism hash
decision_cycle_id
tenant_id
project_id
group_id
device_id
runtime source identifiers
```

## Locale nonclaims

Locale repair does not change runtime semantics.
Locale repair does not translate source identifiers.
Locale repair does not convert replay-backed demo into live production.
Locale repair does not change backend API.
Locale repair does not change contracts.
