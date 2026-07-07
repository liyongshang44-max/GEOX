<!-- docs/frontend-acceptance/PFA-2-LOCALE-EXCEPTION-REGISTER.md -->
# PFA-2 Locale Exception Register

## 1. Rule

Every locale-neutral exception must identify a token, route or surface, reason, owner, and expiry phase. Broad exceptions such as “allow all English”, “allow technical terms”, or “skip this route” are prohibited.

| exception id | token | route / surface | reason | owner | expiry phase |
|---|---|---|---|---|---|
| PFA2-EX-001 | GEOX | all formal surfaces | registered product name; translation would alter identity | PFA-2 Locale Contract | PFA-7 review |
| PFA2-EX-002 | API | Operator, Admin, Customer diagnostics copy only | established technical acronym; surrounding product copy must still be localized | PFA-2 Locale Contract | PFA-7 review |
| PFA2-EX-003 | URL | Operator, Admin, Customer diagnostics copy only | established technical acronym; may appear only as a data/reference term | PFA-2 Locale Contract | PFA-7 review |
| PFA2-EX-004 | JSON | Operator and Admin evidence/readback surfaces | data-format name; not a product heading by itself | PFA-2 Locale Contract | PFA-7 review |
| PFA2-EX-005 | SHA-256 | Export and evidence readback | checksum algorithm name; display label around it must be localized | PFA-2 Locale Contract | PFA-7 review |
| PFA2-EX-006 | AO-ACT | Operator/Admin nonclaim copy only | frozen system capability name; both locales must pair it with the same disabled/non-dispatch boundary | PFA-2 Locale Contract | PFA-7 review |
| PFA2-EX-007 | ID | field, operation, trace, evidence, and device data labels | identifier abbreviation; cannot become a page title or primary product label | PFA-2 Locale Contract | PFA-7 review |
| PFA2-EX-008 | zh-CN / en-US | locale selector and audit evidence | formal locale codes | PFA-2 Locale Contract | PFA-7 review |

## 2. Prohibited exception patterns

```text
allow all English
allow all Chinese
allow technical terms
skip this route
legacy page
temporary forever
not user-facing
```

An exception cannot authorize raw backend errors, raw copy keys, enum leakage, stack traces, or role-boundary drift.
