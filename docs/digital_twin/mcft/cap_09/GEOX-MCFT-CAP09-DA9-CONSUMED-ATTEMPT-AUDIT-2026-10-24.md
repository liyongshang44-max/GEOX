# GEOX MCFT CAP-09 — consumed DA9 attempt: immutable audit and hold
Date: 2026-10-24. Scope: TEST_ONLY. This is a forensic audit note, **not** a recovery or execution authorization.

## Frozen evidence (Windows operator readback; original bytes retained)
- Subject: `2b63652297bb285f21c4d4c63c37d247d009142c`.
- DA9 run: `da9db7129607`, parent `72dc0304a21a`, ordinal 2.
- Original signed bundle: `D:\gptdown\MCFT-CAP09-DA9-OFFICIAL-PERMIT-2b636522-20261024T034215792Z-094f82e8\DA9_OFFICIALLY_SIGNED_ONE_SHOT_RETRY_BUNDLE.json`. SHA-256 `dab356cb712acb35854bf82523ec9f27e8799c10c6dd83aa26ba78281654222f`.
- Official Host preflight: `SIGNED_RETRY_PREFLIGHT_PASS_NOT_EXECUTED`. Irreversible Host execution then returned `STAGE_FAILED_NO_AUTOMATIC_RETRY:PRODUCER`.
- Trust-bound durable ledger: `D:\gptdown\MCFT-CAP09-AUTHORITY-LEDGER\run-da9db7129607`. Operator confirmed existence of `CONSUMED.json`, `STAGE_PUBLIC_KEY.pem`, `STAGE_TICKET_PRODUCER.json`, `SPENT_PRODUCER/CLAIMED.json`, `PRODUCER/STARTED.json`, `PRODUCER/COMPLETED.json`, and two stage logs.
- `PRODUCER/COMPLETED.json`: status `FAIL`, exit `1`, elapsed `919462` ms, `timed_out=false`, spawn/tree errors absent, stage claim present and valid, artifact present.
- `stdout.log`: SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, length 0.
- `stderr.log`: SHA-256 `b2299d403278bde8212a625680dd0e78c3ddac23af4cb45809fb35bbfa509d68`, length 869.
- Producer result artifact: SHA-256 `c449bc4100108967934021327d6983aacff2835d89be78909c34c435ea5ff8d4`, operator independently verified exact bytes.
- Failure text: `V13_EVIDENCE_FENCED_PRETRANSACTION_VALIDATION_FAILED:EXACT_BASE_FACT_PROMOTION_PRIVATE_FORMAL_RETENTION_REQUIRED`.
- Root cause at pinned commit: isolated retention adapter emits `s3-private://mcft-cap09-requal-da9db7129607/mcft-cap09-formal-raw-v1/sha256/{sha256}`; production promotion input validator expected `s3-private://geox-mcft-cap09-formal-raw-v1/...`. Constructor tests were insufficient to catch the cross-component contradiction.
- The fenced promoter identifies this specific validation failure as `NO_FORMAL_MUTATION`, i.e. it failed **before its fact-write transaction**. This does not establish zero object writes, zero controller/lease updates, zero candidate artifacts, or zero other persistent mutations in the entire run.
- No Timing 1/2/3, Controlled Delay or Aggregate PASS has been demonstrated. The single-use Permit and Producer stage capability must be treated as burned. No third attempt is approved.

## Unverified live-postfailure residue — still HOLD
The evidence above does **not** include a fresh postfailure read-only inventory of the DA9 isolated MinIO bucket (current objects, versions, delete markers, multipart), nor a fresh postfailure query of both dedicated DA9 PG databases (facts, forcing targets/cursors/controller leases and negative evidence). Historic pre-run four-zero/29-table readbacks MUST NOT be carried forward as postfailure zero claims.

Required non-destructive readbacks, performed on the original Windows host **without** resetting any state:
1. Independently hash and archive `CONSUMED.json`, nonce mirror, `PRODUCER/COMPLETED.json`, stage claim, Producer result, stdout/stderr; verify the stage receipt's hashes.
2. Use the existing dedicated Inventory account to enumerate all DA9 bucket current, versioned, delete-marker and multipart state, retaining object keys and counts in operator-protected evidence (not in chat). Never call PUT, DELETE, bucket lifecycle reset or IAM provisioning.
3. In read-only PG transactions on `127.0.0.1:55445`, inventory both `mcft_cap09_requal_da9db7129607_positive` and `..._negative`: public fact count, formal source count, controller lease states, forcing target/cursor state, failed claims, sessions, transaction timestamps. Do not rewrite leases or rows.
4. Compare S3 content-address keys and candidate refs to ledger timing; distinguish what was committed vs what was rejected. Preserve all raw evidence and the failed Receipt WORM.

Until these genuine readbacks are obtained, artifact mutation scope is `UNKNOWN`; do not report database/bucket four-zero after the failure.

## New mandatory pre-Permit acceptance standard
CI green, QCP PASS, isolated Composer creation, offline unit tests, credentials and signed Adoption are **necessary but not sufficient**. Prior to ANY new one-shot Permit:
- In a separate non-authorized disposable test DB and isolated S3 bucket, exercise **the same scoped isolated Composer/retention/candidate/fenced-promotion implementation and configuration contract**, including genuine S3 PUT/HEAD and candidate GET, real PostgreSQL fenced routine, transaction COMMIT, read-after-commit physical visibility and cursor attestation. Controlled fixture provider inputs are allowed; replay of prior GFS/KBS or production capture is not needed.
- Reject wrong bucket, cross-run S3 ref, wrong content hash/prefix, wrong Subject, production fallback, and missing authorization identity before PG mutation.
- Record exact candidate source hashes, test-run/subject, two raw objects, three canonicalized facts, committed 3-of-3 PG facts, candidate and physical readback. Verify no Permit, no production, no six-stage operation.
- Independently sign and bind that immutable real physical receipt with a registered reviewer. Both official signer and Host must verify the receipt bytes, source hashes and Ed25519 signature. Unsigned PASS or CI status must never substitute for these.
- Any new attempt number or permit contract needs **separate governance approval**. The current frozen second-attempt authority cannot be reused or generalized to ordinal 3.

**Current disposition: DRAFT_REPAIR_AND_FORENSIC_AUDIT_PENDING; EXECUTION_HOLD.**
