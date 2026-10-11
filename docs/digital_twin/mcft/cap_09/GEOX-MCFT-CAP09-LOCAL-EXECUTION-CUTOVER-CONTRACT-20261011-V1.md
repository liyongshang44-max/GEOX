# MCFT CAP-09 — Local execution and evidence-driven isolation clock successor

**Candidate only; NOT merged, NOT armed; no runtime execution permission.**
Parent implementation PR #3691 introduces a default-disabled retry authority. This document is a subsequent engineering acceptance contract and is not a change to #3691 or the historical ARM.

## Separation of GitHub and Windows authority

- GitHub Actions: compile and unit tests, governed scope, QCP, historical immutable replay, negative gates and signed source review only. No Provider calls, host PG/S3 writes, credential injection, real owner cutover, or live timing/delay steps.
- Windows operator host: fetch exact protected-main commit, verify clean source and independently adopted activation decision; invoke local *host-only* producer, three measurement samples, controlled-delay cases, raw verification, evidence receipt and fail-closed final adjudication. No GitHub workflow dispatch as runtime start mechanism.
- GitHub CI success never conveys permission to perform the host step; host-only execute must consume separately adopted one-attempt authority and check its remaining lifetime at the moment of operation.

## Replace universal fixed six-hour lead (isolation qualification ONLY)

The current draft policy `MCFT_CAP_09_ISOLATED_RETRY_AUTHORITY_POLICY_V1.cjs` asserts `base - authorized > 6h && base - now > 6h`. Future governed engineering successor must **remove this hardcoded lead only in ISOLATED_QUALIFICATION policy**, replacing it with exact, objectively testable readiness:
1. A real target base observation and Provider availability receipt, with causal visibility and deadline; require a target whose ingestion timing is actually supportable.
2. Actual host resource readback of exactly named isolation databases and run-scoped loopback storage, including row counts, object versions, delete markers and multipart state; preserve first attempt and output path.
3. Real measured worst-case host startup/Producer budget with explicit timeout and headroom prior to any *real* data cutoff. Fail if available headroom is insufficient, regardless of elapsed lead.
4. Fresh exact-main, frozen-runtime 108-path proof, current 51+ inherited QCP check inventory, independent supervised retry authorization, short lived expiry and one-attempt nonce.
5. Explicit deadline missed outcome: do not backdate first base, reuse history, silently reset cursor, or treat a missed deadline as a successful synthetic sample.

Production **Formal-v5 ARM, A0/O00–O23, crop window and GFS/KBS availability** remain unchanged and separately enforced. No time contract changes are authorized on a draft branch.

## Work to implement and verify

1. Admit #3691 first with exact-head QCP=0; confirm actual protected-main two-parent adoption and disabled ARM still disabled.
2. On a NEW descendant successor alter the read-only policy and acceptance negative tests; distinguish isolated test observation clock from production deadline. Do not weaken frozen 108 files or unrelated governance validators.
3. Implement `scripts/runtime_acceptance/MCFT_CAP09_WINDOWS_LOCAL_QUALIFICATION_ENTRY_V1.ps1` as host-only process controller that validates exact adopted ARM, consumes an immutable single-use attempt identity, names every launched subprocess, captures exit code/stdout/stderr, freezes result SHA256 and writes run-scoped append-only receipts. No invocation by GitHub Actions.
4. Explicit operator-approved one-attempt activation with separate short-lived ARM and retry adjudication; default remains disabled until that independent approval and merged protected-main validation. Unknown first Provider count remains UNKNOWN.
5. Local host dry-run must demonstrate impossible-to-execute cases (missing ARM, stale main, unapproved retry, wrong bucket, dirty source, evidence hash mismatch, reused output, missing owner isolation, stale readback, insufficient real deadline headroom, production bindings).
6. Only AFTER admission and operator authorization: real isolated Producer, three Timing samples and delay matrix; use unique immutable outputs and require independent QCP decision. No unsupervised retry on partial persistence.

**Current verdict:** `DESIGN_SPEC_PREPARED / SIX_HOUR_RULE_UNCHANGED_IN_CODE / WINDOWS_HOST_EXECUTOR_NOT_YET_IMPLEMENTED / EXECUTE_HOLD`.

## Cryptographic permit and process-recording implementation checkpoint

Implemented primitives (not activation and not live dispatch):

- `MCFT_CAP09_RETRY_PERMIT_V1.cjs`: domain-separated Ed25519 verification of exact permit fields; trusted key fingerprint, issuer role/revocation/lifetime, distinct operator identity, exact main/host/run, and ARM/observations/stage-plan digests. Live loading uses a fixed repository trust path, rejects CI/non-Windows/preloads, and never accepts a caller-selected trust file.
- `MCFT_CAP09_RETRY_TRUST_V1.json`: **unadopted, execution disabled, no issuers**. A separate reviewed governance change must establish the public-key fingerprint, issuer/operator identities, host identity and fixed ledger root. Tests generate throwaway keys; none is enrolled.
- Nonce and run identity are independently reserved with exclusive filesystem operations under the fixed ledger root. Partial reservation and failures burn the attempt; there is no rollback/resume. Four competing processes must produce exactly one successful consumer. These are durable local records, not tamper-proof storage against the Windows administrator; the adopted ledger requires appropriate ACLs, retention and recovery policy. Deleting/restoring the ledger is never an authorized reset.
- `MCFT_CAP09_STAGE_RECEIPTS_V1.cjs`: exclusive per-stage directory, STARTED record, stdout/stderr files, exit/signal/spawn-error/timeout, monotonic elapsed time, content hashes, predecessor hash and write-once COMPLETED record. Windows timeout attempts process-tree termination. Failure preserves evidence and throws without retry. It is a process primitive, not a callable authorization boundary; it grants no qualification PASS.
- CI exercises these primitives with synthetic subprocesses on both Ubuntu and Windows. Hosted Windows tests do not prove the operator host's ACLs, Docker bindings, resources or real Provider availability.

Still unimplemented: adoption and host evidence acquisition; signed-permit admission into the live controller; per-stage child authorization replacing the legacy `qualificationTargets()` ARM lookup; complete live Producer/three-Timing/real-delay wiring; final inherited QCP scope and actual Windows qualification. The existing delay matrix runs a scaled engineering fixture; it must not be relabeled as real Provider delay injection. The retry dispatch guard continues rejecting Execute. This checkpoint does not fix or waive the inherited exact-main/QCP failures.

## Correction from operator-uploaded original reports

The earlier claim that a V6 adjudication report was available is unverified. The operator's directory inventory contains V2, V4 and V5, and their original files were supplied and inspected. They are retained byte-for-byte under `evidence/retry-history-20261011/`, protected from Git line-ending normalization. V2 proves a historical Windows TCP `qual_admin` readback only; V4 preserves the original V3 clean-gate failure and reports 65 boundary tests / 108 frozen paths / 330526 ms historical replay at c9e027b8; V5 reports artifact archival and subsequent clean worktree at that same historical main. V4's provenance-unverified finding is not retroactively changed. None authorizes retry or proves current readiness.

The #3692 structural bridge now requires exact V2/V4/V5 digests and a **separate new `retry_adjudication` digest**, rejects an `audit_v6` alias, and rejects substituting one of those historical reports for the new decision. That digest is still only structural binding; issuer validation and live admission remain separate requirements. The adopted #3691 disabled ARM and its historical tests remain unchanged, so this correction does not silently rewrite already-adopted evidence contracts. No new adjudication has been created or adopted by this correction.

## Signed host admission routing checkpoint

The PowerShell entry now accepts an absolute `RetryBundle` and forwards only the governed retry lane to the existing Node runner. The runner dispatches that lane before legacy `authorize()`. Child `qualificationTargets()` routes either retry marker to the same host admission module and cannot fall back to the historical ARM. Tests exercise the actual runner and actual child function in separate processes, with no temporary output created.

The host admission module validates the fixed adopted trust registry before any source query or bundle read; requires Windows/non-CI/no preload, clean exact remote main, unchanged frozen Runtime, signed ARM/observations/plan digests, consistent run/subject/time binding, local evidence file hashes and decision contents, explicit armed/execute/retry grants, fixed ordered stage names, bounded reviewed budget, and loopback resource bindings. There is no operator-selected trust registry. Cryptographic verification itself still grants no Execute; the host gate separately requires adopted execution enablement.

This is an admission-routing checkpoint, **not complete executable dispatch**. The five-stage Producer/three-Timing/aggregate plan cannot satisfy real controlled-delay coverage. Execute therefore rejects before nonce consumption, output creation, or Provider calls; child launch authority also remains unavailable. Next work must implement and admit the real-delay stage, then connect parent reservation, per-stage child consumption and chained subprocess receipts as one complete sequence. Merely setting trust booleans cannot make this checkpoint execute. No current Windows live qualification, inherited QCP PASS or retry activation is asserted.
