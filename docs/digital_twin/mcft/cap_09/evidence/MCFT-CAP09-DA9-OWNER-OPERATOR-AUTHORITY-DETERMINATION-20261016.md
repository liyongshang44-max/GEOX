# MCFT CAP-09 — owner-operated authority applicability determination (2026-10-16)

**Outcome: ROLE_ELIGIBLE / ADOPTION_NOT_ESTABLISHED / EXECUTION_HOLD.** Read-only contract determination; **not** an adjudicator approval, policy adoption, signature, trust-root activation, Permit, or host admission.

## Scoped question

May the registered `ACCOUNTABLE_SINGLE_OPERATOR` role satisfy the governance contract for a run-scoped Retry Adjudication request for `da9db7129607`, subject `91835fa0997730c85c5f3869dd530f4c9a3ca82d`, attempt 2, without claiming another human custodian?

## Documentary evidence and decision

1. `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ADR-ADOPTION-QUALIFICATION-LOCAL-EXECUTION-ADMISSION-V1.md` is **APPROVED ARCHITECTURAL DIRECTION; IMPLEMENTATION AND MIGRATION NOT ADOPTED**. Its signer clause expressly states `ACCOUNTABLE_SINGLE_OPERATOR remains allowable` but requires distinct signer and verifier code paths and independent cryptographic verification. Therefore **a second natural person is not a universally required architecture condition**. This does NOT supersede more restrictive scope-specific requirements for the retry decision.
2. Real `scripts/runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs` accepts `ACCOUNTABLE_SINGLE_OPERATOR` and `INDEPENDENT_RETRY_GOVERNANCE` issuer roles. The latter alone requires `issuer_id != operator_id`. Signature verification alone returns `SIGNATURE_VERIFIED_NOT_EXECUTION_AUTHORITY`. Durable consumption alone does not grant execute authority.
3. `scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json` registers `mcft_cap09_operator_mylr1` as `ACCOUNTABLE_SINGLE_OPERATOR` with fingerprint `223c806e89c4e6df5e91a089e0b22e5cef05934d42ee7df817faaeaa67553365`, but still has `adopted=false`, `execution_enabled=false` and other execution capability adoption flags false. Its separate independent issuer must not be impersonated.
4. `scripts/cap09_adoption_v1/contract.cjs` plus README is a deliberately `SYNTHETIC_ONLY` candidate and cannot be relabeled as real authorization.
5. The existing retry-admission bridge explicitly rejects an unapproved adjudication; as written, it checks decision booleans and evidence digests, but a real signed run-specific decision still requires *authenticated* adoption, exact evidence provenance, and applicable authority. A permission boolean alone cannot serve as approval.

**Determination:** Owner-controlled single-operator cryptography is *architecturally permissible for applicable workflows*, but the present run's formal adjudication is **not yet adopted**; existing retry policy text demands explicit supersession by an authorized principal, and neither owner instructions, key registration, nor prior synthetic tests form an authenticated decision. This is a governance status determination, not a representation of legal compliance with any unprovided external contract or law.

## Exact approval/adoption requirements before next phase

A. Identify the prevailing retry adjudication policy and establish in a traceable reviewed instrument that `ACCOUNTABLE_SINGLE_OPERATOR` has **the explicit power to supersede the prior denial for this run and second TEST_ONLY attempt**. If the existing scope-specific policy requires an independent governance authority, follow the sanctioned policy change/adoption route rather than re-label that signer.

B. Produce an attributed, dated, run-/subject-/parent-/attempt-bound adjudication ID that refers to all six verified historical evidence digests, explains the Producer formal-raw-bucket failure and isolated composition seam without asserting successful real execution, acknowledges first Provider calls `null` and original phase `UNKNOWN`, explicitly supersedes the identified previous denial and prohibits production scope. Preserve an immutable separately hash-verified seventh adjudication file.

C. Only once that decision is approved under a recognized policy: adopt a narrow, reviewed trust configuration on the exact Windows subject/host with verified fingerprint, signature, signer/verifier separation, negative tests and unchanged runtime/frozen 108 paths. Any trust activation must be independent of untrusted bundle contents and recorded; do not directly flip `adopted`/`execution_enabled` as a surrogate for this process.

D. Then follow immutable order: fresh signed Adoption + measured real six-stage deadline budget → immediate PostgreSQL/MinIO/ACL/Provider causal readbacks (including versions, deletes, multipart, output/nonce freshness) → signed one-time TEST_ONLY Permit → official Preflight → authentic Windows six-stage evidence.

## No-change declaration

No authorization/approval booleans altered. No signature minted; no policy, key, runtime, database, bucket, ledger, permit or output changed. Historical 6/6 evidence reused as already verified; first Provider count stays `null`. **Retry Adjudication HOLD; TEST_ONLY HOLD; Production HOLD.**
