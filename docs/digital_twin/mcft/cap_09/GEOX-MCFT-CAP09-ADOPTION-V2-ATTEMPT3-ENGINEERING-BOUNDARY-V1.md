# CAP-09 / Adoption V2 × Attempt 3 — engineering boundary V1

**Status: EXECUTION_HOLD.** Baseline protected main: `e7a8f30ffb60cb4c2bc6bd83d7bbe487eb708cc9`.
This document describes a *new technical eligibility slice*, not an execution-adopted contract, Permit, or full-chain proof.

## Immutable evidence and intended identity

| Evidence / role | Value |
| --- | --- |
| Historical second attempt | `da9db7129607` |
| Historical parent | `72dc0304a21a` |
| Historical second-attempt subject | `2b63652297bb285f21c4d4c63c37d247d009142c` |
| Historic run/nonce consumed twin SHA256 | `f8c55961e2b4972e8e2b92ad0d788b6030240f97e2bc274edf206fb5833ea21a` |
| New candidate Run | `6ff9b41f6f7f` |
| New candidate attempt | `3`, subject to signed all-attempt and sealed-failure review |
| Windows Host | `LAPTOP-STN2A2P1` |
| Scope | `TEST_ONLY`; no production, cutover, Formal A0, O00 or automatic retry |

**Historical Permit consumption is not historical six-stage success.** `df091a71aafc` stays sealed and is not silently counted as a consumed authorized attempt. The original two historical ledger files are Windows-host evidence; the uploaded read-only V2 JSON alone cannot cryptographically reverify the original Permit.

## Versioned technical eligibility (this branch)

`scripts/governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs` implements three explicit checks:

1. **QCP64 baseline / QCP65 successor → Formal54 definition mapping.** Exactly 54 existing formal policy checks; original main contains 10 identified source/engineering-only checks, while this PR adds one independently named technical-only QCP check (11 in total). The extra ten are **not** promoted to formal Adoption authority. There is no synthetic 64/65→54 truncation, no changed historic 55-check artifact, no permission to replay 55/54 signing.
2. **Read-only historical ledger twins.** Read the exact `run-*` and `nonce-*` bytes and require the immutable SHA256, byte equality, original subject, parent, ordinal 2, Windows host, time window and signature-stripped verified object. This is ledger integrity, not an Ed25519 signature re-verification.
3. **Purpose-specific Attempt-3 review verifier.** A fresh Ed25519 review under domain `GEOX_MCFT_CAP09_ATTEMPT3_LINEAGE_ADJUDICATION_V1` binds new exact source subject, original protected baseline, host, run/parent/ordinal 3, immutable DA9 consumption SHA, **real sealed-failure evidence SHA**, **all-attempts inventory SHA**, review window and `TEST_ONLY`. Existing registered retry issuer roles remain in control; an old DA9 signature is never valid for this new payload or domain. **No signing key is generated/issued for real authority.**

A separate `scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_READONLY.cjs`
verifies a versioned Attempt-3 Permit *signature envelope* under a different Ed25519
domain from historical V1. It binds exact Source/Host/Run/Parent/ordinal, 256-bit
nonce, signed ARM/observations/stage plan digests, Adoption V2 proof digest,
lineage review digest and isolated resource digest, and checks issuer role/key
validity and lifetime. This module cannot sign, consume, reserve ledger slots,
issue an execution capability or call the Host. It returns
`ATTEMPT3_V2_PERMIT_SIGNATURE_VERIFIED_NOT_ADOPTED_OR_CONSUMED` on valid
offline test-only evidence, with every authority boolean false. All unit
signatures are ephemeral synthetic fixtures. The actual Windows Host is **not**
connected to this V2 validator.

The new gate **always** returns `ENGINEERING_LINEAGE_VERIFIED_EXECUTION_HOLD` even after valid technical inputs; its returned booleans for Adoption/Permit/stages/production are false.

## Remaining closure work (MANDATORY before any real execution)

- Design and source-qualify the **full** Adoption V2 signed evidence format and authentic **current 65-check** QCP artifact→54-check formal proof with exact new HEAD and release material. The code in this branch validates *definitions*, not source PR artifacts, historical/native QCP result evidence, or signed Adoption.
- Finish independent **versioned Host/Permit V2 and Admission Bridge** beyond the now-implemented **read-only** Permit V2 envelope verifier, consume the valid V2 adoption context and bound Attempt-3 lineage signature, retain atomic nonce/run ledger semantics. Legacy `MCFT_CAP09_RETRY_PERMIT_V1.cjs` still requires ordinal 2 and **MUST NOT be edited to 3**. Production trust defaults remain disabled.
- Bind new **real** independently assigned loopback PostgreSQL positive/negative databases, dedicated restricted logins and MinIO endpoint/bucket. Do not invent a port, credential, ownership assertion or use the DA9 resources. Positive/negative ACL and zero-state must be read from actual Windows host.
- Complete **new-subject, distinct-run, signed non-authorized full-chain S3→Candidate→PG→readback proof**, which remains an original mandatory pre-Permit gate. Do not reclassify CE94 or `df091a71aafc` evidence as this proof.
- Obtain genuine owner-reviewed current-subject signing authority, a valid short-lived exact-run Permit only **after** all live preflights, then run original six stages once and retain event ordering and Stage receipts. Until then `6ff9b41f6f7f` is `HOLD`.

## Central QCP registration and new dependency ownership

This PR appends the *single* independent check `CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_TEST_ONLY` to the existing 64 registered checks. Exactly seven paths, including the central QCP document itself, are owned by `CAP09_ADOPTION_V2_ATTEMPT3_EXACT_SEVEN_PATHS_V1`; the prior 64 check definitions and their resolvers are untouched. This is QCP 65 **technical source qualification only**, not revised historical 55/54 artifact or new signed Adoption. Any current QCP/EA5E2 failure remains a real gate, never silently classified N/A.

## Explicit exclusions

No edits to old V1/V2 historic validators, Frozen V13 108-path digest, old ledger, signatures, historical artifacts, DA9 existing resources, Provider science, old physical runs, or production authority. CI unit tests use **ephemeral in-process test-only Ed25519 fixtures** and synthetic receipts; their PASS does not establish Windows host physical authority. Do not mark this branch as executable or merge simply because the bounded engineering unit tests are green.
