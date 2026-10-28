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

This PR appends the *single* independent check `CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_TEST_ONLY` to the existing 64 registered checks. Exactly 16 paths, including the central QCP document itself, are owned by `CAP09_ADOPTION_V2_ATTEMPT3_EXACT_SOURCE_PATHS_V2`; the prior 64 check definitions and their resolvers are untouched. This is QCP 65 **technical source qualification only**, not revised historical 55/54 artifact or new signed Adoption. Any current QCP/EA5E2 failure remains a real gate, never silently classified N/A.

## 2026-10-28 Implementation extension (no physical admission)

New V2 source consumers were added in the same existing #3747:
- `scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs`: checks **all 65** actual current-subject QCP result entries; all original 54 policy identities and only the five allowed formal N/A, 11 technical checks PASS, zero failures/blockers, source QCP report bytes SHA, GitHub run/event/artifact identities, exact release-source inventory, real installed material digest, registered ADOPTION key and Ed25519 V2 signature. Returns **SIGNED_QCP65_ADOPTION_V2_EVIDENCE_VERIFIED_NOT_PERMIT** with no execution authority. The V2 signature must be issued only after a genuine exact-HEAD all-green QCP raw report exists. A user-authored synthetic PASS JSON without real QCP evidence is not an acceptable admission source.
- `scripts/cap09_adoption_v1/SIGN_MCFT_CAP09_ADOPTION_V2_OFFLINE.cjs`: Windows-only registered-key CLI with no overwrite and post-sign verification. Cannot sign here without user's actual offline private key, fresh eligible material and QCP65 report.
- `scripts/governance_acceptance/MCFT_CAP09_ATTEMPT3_RESOURCE_OWNER_V1.cjs`: signed TEST_ONLY Windows owner/readback contract with separate new positive/negative PostgreSQL, bucket, restricted ACL, zero-row/zero-object-state, time window, exact run/host/source binding. **No actual host probe has been performed**. Owner signature asserts actual field measurements; this checker does not independently query PG/S3.
- `scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs`: reads genuine V2 Adoption + distinct lineage + resource owner + original signed nonauthorized S3→Candidate→PG physical full-chain + Permit V2 envelope **before** considering any ledger burn. Atomic dual run/nonce write logic is implemented but **explicitly blocked** by `HOST_V2_STAGE_DISPATCH_ADOPTED=false`. Existing V1 child stage capability's `assertConsumed` is tied to the V1 Permit WeakSet, so cannot legitimately receive a V2 consumed token. Do not burn an Attempt-3 Permit before a separately qualified V2 child-stage dispatch path exists. There is NO CLI to consume V2 Permit now.

The central QCP 65th check owns exactly **16 paths** under `CAP09_ADOPTION_V2_ATTEMPT3_EXACT_SOURCE_PATHS_V2`; its title is historic but the resolver is the current exact list. All original 64 checks remain unchanged. Current CI/QCP stage3/frozen historical false statuses must be assessed individually; do not rewrite frozen signatures or treat exact old PR-3734/3737 event-specific validators as general successor qualification.

**Remaining actual effects:** create and verify dedicated Windows PG/S3; obtain fresh real current HEAD QCP65 raw all-green evidence, actual signed Adoption V2 and resource owner review, signed separate physical full-chain attestation, and implement/qualify Host V2 child-stage capability before atomic Permit consumption or original six formal stages. All remain **HOLD** today.
## Explicit exclusions

No edits to old V1/V2 historic validators, Frozen V13 108-path digest, old ledger, signatures, historical artifacts, DA9 existing resources, Provider science, old physical runs, or production authority. CI unit tests use **ephemeral in-process test-only Ed25519 fixtures** and synthetic receipts; their PASS does not establish Windows host physical authority. Do not mark this branch as executable or merge simply because the bounded engineering unit tests are green.

## 2026-10-28 — #3747 exact 16-path QCP applicability and immutable historic boundaries

The historic `HOLD_COMPOSITE_EXACT_13_PATHS` diagnostic belongs to the
`VERIFY_MCFT_CAP09_3740_3744_OWNER_COMPOSITE_V1.cjs` predecessor: its
frozen base, native event, path inventory and 60→63 check transition
are not those of the present #3747. A direct failure on this successor
**remains a historical check failure**, not evidence that the #3747
16-path source diff is unreviewed. No historical check expected-path
value, QCP definition, signature or prior failure receipt is rewritten.

`DA9_SEMANTIC_SUCCESSOR_COMPOSER_SCOPE_CHANGED` similarly denotes
a genuinely distinct Composer identity. The old signature-bound Composer
blob is `7e74b1df502e159dd49ceb21889cbfff86408e50`; the current
protected-main Composer blob is
`2d1f72d92c05093537774285bda5b7200845344d`.
The old six operator signatures **cannot transfer** to this different
source identity. A new source-specific proof is required for any
subsequent signed Adoption/Permit. Their cryptographic validity for
the original exact subject is not revoked or extended here.

The #3747 checker `VERIFY_MCFT_CAP09_3747_INHERITED_SCOPE_V1.cjs`
now asserts that both original historic verifier blobs are unchanged,
the old composite exact-scope guard still exists, and the current
16-path diff remains the single registered source scope. Only four
inherited **technical-source** QCP checks can receive
`NOT_APPLICABLE` for this new scoped delta; **no historic FAIL is
converted to a PASS**. The new QCP 65th check remains `REQUALIFY`
until its own current-HEAD native source and evidence acceptance passes.
No complete QCP65 all-green result, Adoption V2 signed authority,
Host V2 stage-dispatch qualification, or Permit follows from the
scoped technical checker alone.

A separate Windows disposable Run `b17d2a9f3c60` at the
baseline `e7a8f30f...` has independently verified real MinIO
retention/private candidate readback and PostgreSQL three-fact
fenced commit/Controller attestation/cursor. That is **TEST_ONLY**,
uses controlled Provider fixtures, and belongs to a different
Run from candidate Attempt-3 `6ff9b41f6f7f`. Its evidence must be
signed and entered into a distinct exact-source technical qualification
record before it can even be considered for further gates; it cannot
be carried forward after modifying the source HEAD.

## 2026-10-28 — bounded current-HEAD Phase3 requalification

This PR also independently checks the current Phase3 **94 exact dependency
Git blobs** against the independently qualified #3743
source `cd18701600346840b7e4cc3611a7108f2e713490`.
A read-only source comparison found all 94 blobs identical to protected
main `e7a8f30ffb60cb4c2bc6bd83d7bbe487eb708cc9`.
The current graph digest is
`sha256:8af6025cd4be03227ed06a39f8f5f7fc51cdc862f3e12319fcb318e00864f145`;
the old 24cd Phase3 digest
`sha256:d5d1cf09c4cde3b0fe82e658d9af2b25fe5beccee1a582d40ba00349fab8534b`
remains invalid on the current graph.

A new exact #3747 PR-native `verifyPhase3Successor` requires:
current event/HEAD/base/16-path scope; the 94 unchanged Git blob
identities; the unchanged owner policy and source manifest; the
authenticated live #3743 CI and real PostgreSQL qualification jobs
plus immutable artifact `12738863652` with digest
`sha256:0a05c94f21df6f8164b4cc3e37f09fbddf6663dfabee605443ec833e58177502`;
and the original #3745 owner-directed GitHub-native source-review
runs. **No technical PASS without all live proofs**. This path
requalifies the *same Phase3 source bytes*, not the old 24cd historical
Run, six operator signatures, Frozen V13 source or DA9 formal governance.

The Phase3 QCP check can be marked `PASS` **only when** this
independent real-source exact-blob/native proof succeeds. The five
Composer scope-change blockers and the PR3734-specific formal DA9
admission remain separate `FAIL` until their distinct evidence is
available. This route grants no Adoption/Permit, authorization, Owner
activation, formal six stages or production write.

**Decision: historical Frozen V13, DA9 signer succession and Stage3
predecessor checks retain their actual outcomes. The #3747 technical
scope assessment is independent and non-authorizing.** Adoption HOLD,
Permit HOLD, original formal six stages 0/6; preserve both Windows
test environments, all historical data and frozen failure receipts.
