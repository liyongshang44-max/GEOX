# MCFT CAP-09 — Isolated retry authority successor candidate (2026-10-11)

**STATE: DRAFT / PROPOSED / UNARMED / DO NOT EXECUTE.**
This record requests a fresh independent governance adjudication; it is NOT an executable ARM, an authorization, or a replacement for any existing approved evidence. Do not merge until exact-scope verification and reviewers approve a separate, fail-closed implementation successor.

## Exact engineering subject
- Protected-main subject at branch creation: `c9e027b832d1e25a20384d4853ed5564ed405fd4` (merged PR #3689).
- Qualification run lineage: `72dc0304a21a`; first attempt subject: `2e4c3e7ac0b0e300b15b26b2f6111e7d39de328b`.
- Earlier arm `scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_ISOLATED_QUALIFICATION_ARM_20261010_V1.json` is immutable and must NOT be edited or extended in place.
- Existing arm first base 2026-10-11T00:00:00.000Z; expires 2026-10-11T06:00:00.000Z. Its `first_base > now + 6h` rule remains mandatory. A later expiry does not waive lead time. Both clock values must be freshly selected/adjudicated, not inferred from this draft.
- A moving protected main requires renewed exact-head evidence and successor requalification.

## Evidence (operator-supplied; do not claim independent GitHub attestation)
- First attempted Producer result: FAIL `POSTMERGE_V13_PRODUCER_CORE_FORMAL_RAW_BUCKET_REQUIRED`; fail receipt is retained, with SHA-256 `00a5eb698fcd9ed0d18689fdd6e25df9e4b2e321e412d8565fec12a04b39b9c8`. `first_execution_provider_calls=null` (unknown, do not treat as zero).
- First `started.json` SHA-256 `5b6ab70a869002f3b9841acf9e55231315b35144979f252b6ad2a4623fb4ec19`; initial V1 audit SHA-256 `47553066e96e8b259f4a7c0d9d91b8531109184011d2a68b6fb6ef0c19526a05`.
- Read-only audit V2 at 2026-10-10T10:20:15.776Z reports 29/29 tables empty in EACH local positive and negative database and an empty isolated object bucket including current objects, versions, delete markers and multipart uploads. It explicitly reports `qualification_pass=false`, `execute_retry_authorized=false`. This is a time-scoped readback, not ongoing emptiness or proof of no prior requests.
- Windows exact-main #3689 checks: execution boundary 65 PASS, preparation 108 frozen paths PASS, bounded historical replay PASS 330526ms/1200000ms, QCP check count 51. V3 historically failed final clean gate because generated `acceptance-output/` was untracked. V5.1 archived its one file (`MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.json`, SHA-256 `f6d792dee2c71ff4bfa577e1579022c33ee70fe64e2f5385f02a1709604176d2`) and restored exact-main clean worktree. Do not revise V3 verdict.
- Independent read-only V6 operator report: `evidence_hash_verified=true`, `execute_authorized=false`, `retry_authorized=false`, `producer_result_phase=UNKNOWN`.

## Requested successor admission, ALL required
1. A governed exact-diff candidate MUST be separately submitted and tested; this documentation candidate grants **no execution permission**. No changes to frozen Runtime, production bucket, canonical producer wrapper, original ARM, historical attempt receipts or production DB/schema.
2. Dedicated new run/attempt identity or formally governed retry ordinal with a **new never-before-created immutable output directory**. Preserve the first attempt and its failed receipt. Decide whether reusing the previous run lineage is admissible; do not silently reset it.
3. Capture **fresh** read-only database, object-storage (including version/multipart), owner isolation and source-worktree inspection immediately before any future execution. Verify V1/V2/V6 evidence file hashes and the first error-phase boundary from receipt/logs; unknown Provider count must remain explicit.
4. Separate reviewed authorization artifact binds EXACT current protected main, new target logical first base with STRICT >6h lead at the instant of authorization and execution, narrow <=24h expiry, exact loopback databases and run-scoped bucket, and limited ISOLATED_QUALIFICATION only. No operator-side edits or bypass environment variables.
5. An explicit retry adjudication is required; pre-existing `execute_retry_authorized=false` remains effective until independently overruled by authorized governance. No automatic retry, reset, cleanup, or reuse of first output path.
6. Mandatory QCP including all prior 51 checks, exact allowed paths and merged-main historical replay, 108 frozen runtime paths, negative tests for stale main, old base, premature first base, expired ARM, reused output, production bucket/external endpoint, first evidence hash mismatch, missing adjudication, forbidden modes.
7. Only after a **separate implementation PR** has been reviewed, passed required CI, merged via governed protected-main adoption and revalidated on Windows may an operator request an explicit execution decision. CI/PR drafts never perform real Provider, PostgreSQL or S3 writes.

## Explicit prohibitions
- NO live Producer/Timing/delay runs by this document.
- NO production Recovery, owner cutover, Formal-v5, A0, O00–O23, 24T signoff or Product data publication.
- DO NOT manufacture PASS, infer zero first-attempt Provider requests from `null`, or treat temporary resource emptiness as a retry permit.

**Disposition:** `NEW_ISOLATED_RETRY_AUTHORITY_CANDIDATE_PREPARED / GOVERNANCE_NOT_ADOPTED / EXECUTE_HOLD`.
