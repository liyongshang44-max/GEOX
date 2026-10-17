# DA9 retry bundle construction candidate

This tool is a candidate, not an adopted Windows execution controller. It never
contacts PostgreSQL, MinIO or a Provider, runs a stage, consumes a permit, deletes
probe objects, edits the Runtime or approves a review. Its only filesystem writes
are new, exclusive output files. No production authority is available.

`node da9-retry-bundle.cjs draft DECISION_ID NEW_REVIEW_FILE` produces an unapproved
run-/subject-/attempt-bound decision with the six fixed historical hashes and
unknown original Provider count/phase preserved. Changing a draft's booleans is
not governance approval.

The signing API accepts an input file with exactly: `decision_file`, `files`,
`observed`, `plan`, `authorized_at`, `expires_at`, `qualification_first_base`,
`output_directory`. `files` maps the six historical keys plus `retry_adjudication`
to absolute original files. `observed` is the existing official Bridge/Host
observation contract, not a translation of static infrastructure PASS. The
readback includes canonical `started_at` and `completed_at`; its entire collection
window must fit within five minutes. Plan is the official six-stage v2 contract.
Budgets and Provider availability must come from actual evidence, not defaults.

The Windows `sign` mode takes, in order: input JSON, signed Adoption request,
immutable Runtime root, private key file, registered issuer ID, registered key ID,
and a new Bundle output file. It verifies the fixed-policy Adoption first,
requires the named adjudicator to match the registered permit signer, rehashes
referenced files, checks freshness, signs the exact ARM/observations/plan with a
new nonce, then invokes the existing official permit and Bundle validators. It
does not consume the nonce. Its result is only readiness for official Preflight.
The official runner must still perform `--preflight-only`, followed by separately
authorized `--execute`; do not automate that transition or retry.

## Remaining adoption and live integration blockers

- The protected main/frozen 91835fa0 verifier requires INDEPENDENT_GOVERNANCE.
  This PR's newer signer/verifier candidate supports ACCOUNTABLE_SINGLE_OPERATOR
  **only** with an exact bound formal_adoption_scope, but no actual scoped trust
  registration has been adopted. The old installed verifier remains ineligible.
  An independently qualified, versioned successor execution material is needed;
  changing old installed bytes or faking an independent human reviewer is forbidden.
- Current Host code loads its verifier from inside the Runtime. A newer external
  verifier is not automatically the verifier used by the retained 91835fa0 host.
  Preserve the Runtime; prove/adopt the actual loader integration before claiming
  this offline path reaches real execution.
- Handoff 692461f6 records two retained qualification objects in the main run
  bucket. The Bridge requires the bucket empty including versions and uploads.
  A fresh factual result must resolve that conflict; do not clear retained
  evidence or report empty merely to pass the gate.
- No live V2/decision/readback package, signing key or Windows execution surface
  is available in this checkout. Live signing, official Preflight, positive
  assembly integration and the six stages have NOT been tested here.

Validation in this candidate: 16 focused tests covering timestamps, exact
resources, nonempty bucket rejection, production rejection, default-unapproved
draft, forged Adoption context, official stage order and exclusive output.
These are unit/negative tests, not a positive live qualification claim. CI adds
these tests on Windows and Ubuntu; existing tests remain intact.

## Scoped formal Adoption candidate (not activation)

The formal signer and offline verifier now share `assertFormalIssuer`. Independent
issuers retain the identity-separation requirement. An accountable operator is
eligible only when its ADOPTION registration contains an exact
`formal_adoption_scope` with `subject_sha`, `material_digest`, `host_id`,
`operator_id`, and `scope: TEST_ONLY`. All five values must match the signed
qualification; unknown scope fields are rejected. The policy digest covers this
registration. The signer selects the unique non-revoked registered public key
matching the supplied private key, then applies the same eligibility rule as the
verifier. Existing unscoped operator registrations remain ineligible.

No real registration scope has been added. This change does not issue Adoption,
change fixed trust defaults, grant production authority or consume a permit.
Synthetic acceptance includes the actual formal signing function followed by
formal verification, plus signing refusal for each of the five scope mismatches.

Frozen Host interoperability now has TWO bounded, fail-closed candidates.
For a new versioned execution material, the *installed* Host and offline verifier
must byte-match the vetted controller/verifier and also satisfy signed release
material qualification. For the original immutable `91835fa0` verifier, the
tool recognizes only its exact pinned Git blob and an unchanged trust registry.
That grandfathered verifier accepts only a REAL `INDEPENDENT_GOVERNANCE` formal
Adoption signature, never an `ACCOUNTABLE_SINGLE_OPERATOR` adoption. The
signer checks signer role/registry on the old release, verifies Adoption with the
new verifier, then independently loads and verifies the same signed Adoption
using the *installed* frozen verifier and compares proof/material digests.
The Host and each child will repeat their own verification under their own
private verified-context set. No WeakSet injection, preload, module-cache spoof,
or frozen file replacement is used.

The independent route is technically compatible **only if genuinely authorized
independent governance custody and a valid old-version Adoption exist**; key
registration alone is not evidence of that. With only the accountable operator
key, the original frozen Host remains blocked. A separately qualified and
adopted versioned successor with a fresh source/material subject is still
required for the single-operator path. No new subject/Run ID or authorization
is silently invented by this change, and neither branch grants execution.

The retained MinIO probe objects remain a separate unresolved precondition.
The current contract requires the entire target bucket, versions and pending
uploads to be empty; this candidate still rejects a nonempty bucket. It neither
excludes probe keys nor deletes or migrates evidence. Original object/version
metadata must be reviewed before changing any resource or admission contract.

## Frozen-Host byte-identity safety gate (2026-10-16)

Before the external signer can mint a nonce or a signed permit, it now checks
the *installed* Runtime's `scripts/cap09_adoption_v1/offline-context.cjs`
against the externally used verifier's exact SHA-256 bytes and requires the
installed Host entry to be present. If the frozen target is an earlier verifier,
signing fails with `FROZEN_HOST_VERIFIER_INCOMPATIBLE_NO_PERMIT`.
This is a **necessary, not sufficient** compatibility condition. It does not
patch, preload, replace, authorize or execute the frozen Runtime. Matching
bytes alone cannot establish a qualified six-stage Host handoff.

The existing `91835fa0` installed Runtime is expected to reject the newer
scoped-operator verifier unless a separately adopted execution-material
successor is established. Do not attempt to bypass the private verified-context
set or issue a permit before actual Host-verified admission. Three negative/
byte-equivalence fixture checks were added to the DA9 test entrypoint.
The MinIO probe-object conflict remains HOLD until a read-only real inventory
and approved evidence-preserving disposition are available.

## DA9 MinIO full read-only inventory (candidate, not admission)

Script: scripts/cap09_adoption_v1/da9-minio-readonly-inventory.cjs
Fixed S3 endpoint: http://127.0.0.1:59005 ; exact bucket: mcft-cap09-requal-da9db7129607.
It makes SigV4-signed GET requests only, enumerating current objects, versions, delete markers and multipart uploads, with bounded pagination.
It never deletes, migrates, empties, puts, changes policy, or grants any run authority.

Windows-only operator invocation: node scripts/cap09_adoption_v1/da9-minio-readonly-inventory.cjs D:\gptdown\MCFT-CAP09-da9db7129607-MINIO-INVENTORY.json
Output must not already exist. Supply dedicated run-scoped credentials via MCFT_CAP09_DA9_MINIO_ACCESS_KEY and MCFT_CAP09_DA9_MINIO_SECRET_KEY;
optional MCFT_CAP09_DA9_MINIO_REGION (defaults to us-east-1) and MCFT_CAP09_DA9_MINIO_SESSION_TOKEN.
The tool never prints or saves secrets. A local exclusive JSON report records object keys, version IDs, upload IDs and readback time.

Any retained object, historical version, delete marker or pending upload yields BUCKET_NOT_EMPTY_HOLD.
A complete empty inventory yields only EMPTY_READBACK_CANDIDATE_ONLY, never Admission PASS or execution authority.
Denied or partial list operations, missing pagination markers, excess pages and timeouts fail closed.
The local list is not an independent archival signature or atomic transaction snapshot.
No probe object is to be erased or excluded until an authorized evidence-preserving disposition is verified.
Pure parsing/signing contract tests run in CI on Ubuntu and Windows; CI makes no real S3 request.

## Separately signed Retry Adjudication — required before Adoption/Permit

Candidate code now refuses an unsigned APPROVED JSON decision, even if its boolean flags were manually set.
The separate `review-sign` command requires an intentionally completed review JSON and the authorized signer's private Ed25519 key, outside the immutable Runtime:
`node scripts/cap09_adoption_v1/da9-retry-bundle.cjs review-sign ABSOLUTE_REVIEWED_JSON ABSOLUTE_PRIVATE_KEY REGISTERED_ISSUER_ID REGISTERED_KEY_ID NEW_SIGNED_DECISION_JSON`

The input must already contain `review_status=APPROVED`, `retry_admissible=true`,
`prior_denial_explicitly_superseded=true`, an attributable `reviewer_id`, exact `review_issued_at` / `authorized_at`,
`review_authority_ref` (authorizing governance provenance), an explicit >=100 character `supersession_rationale`
explaining the exact formal bucket constraint, the isolated TEST_ONLY successor, and UNKNOWN Provider call count.
Required historical anchor digests remain unchanged; `prior_denial_sha256` must equal the first failed receipt hash.
The `review_policy_sha256` must match the SHA-256 of the canonical fixed retry trust registry;
the signing principal must match the registered live signer. The signed file cannot overwrite the review input.

`review-sign` creates a separately domain-separated Ed25519 signature over the complete decision payload.
`sign` now verifies that independent review signature, signer role and key fingerprint, trust digest,
exact run/subject, denial anchor, scope, rationale, clock and first Provider count (`null`) BEFORE assembling
a one-shot Permit. Editing `APPROVED`, changing any rationale, or replacing the file fails closed.
Cryptographic review verification is explicitly NOT an adopted authorization policy or Windows Host execution proof.
Existing static trust stays disabled. There is no automatic promotion from signed review to Admission.

Critical sequence: authenticated Retry Adjudication → fresh signed Adoption and six-stage budget → fresh
resource/Provider causal readback → signed one-time Permit → official preflight → six-stage Windows execution.
Old frozen 91835fa0 Host remains incompatible with the *single-operator* formal verifier.
Only a genuinely authorized independent Adoption, verified by both signed-proof
verifiers, is a potential unchanged-frozen-Host route; else use a qualified
new-subject versioned successor. Neither a signed review nor a MinIO inventory
resolves those gates.

Windows and Ubuntu CI now include a bounded `git show` of exactly the
retained 91835fa0 verifier blob (not historical replay), with positive
independent-role precheck and explicit operator-role, trust-file drift, missing
adoption request, and modified verifier rejection. This tests compatibility
eligibility only; no authentic Adoption was signed or loaded on the Windows host.

## Windows pre-sign dual-verifier read-only gate

Run on the local Windows machine with an authentic already signed Adoption and the exact installed immutable Runtime:

`node scripts/cap09_adoption_v1/da9-retry-bundle.cjs audit-host-adoption ABSOLUTE_RUNTIME_ROOT ABSOLUTE_SIGNED_ADOPTION_JSON`

This command checks the pinned Host and verifier, resolves the actual installed verifier, verifies the Adoption and material profile with the candidate and (for historical 91835fa0) the old installed verifier, and compares both digests. It explicitly checks subject, TEST_ONLY scope and no production authority. It does **not** use private keys, generate nonce, issue Permit, change trust, connect to MinIO or authorize execution. Failure is an execution HOLD; a PASS only establishes pre-sign compatibility, not Retry Adjudication, Provider, budget or resource Admission. Do not run with synthetic credentials, synthetic Adoption or against production.

## 2026-10-17 DA9 real-host WORM recovery and successor gate (NO EXECUTION AUTHORITY)

This checkpoint records observed evidence, not the missing signed approval. See the
non-merged handoff PR #3298 comment 6230516883. It must not be interpreted as
a new authorization, a confirmed WORM retention receipt, or an instruction to
empty a bucket.

### Verified host observations

- The DA9 PostgreSQL and MinIO containers use 127.0.0.1:55445 and
  127.0.0.1:59005. Do not confuse these with separate run 73b04afb4249
  on ports 55446/59006.
- Both DA9 PostgreSQL databases were inspected through the actual container
  using `qual_admin` and `BEGIN TRANSACTION READ ONLY`: each has 29 public
  tables and exactly zero rows. This is **not** a substitute for a later fresh
  resource readback or the scoped Evidence/Twin login/ACL matrix.
- Actual DA9 MinIO root-identity **read-only inventory** returned
  `BUCKET_NOT_EMPTY_HOLD`: two current probe objects, two corresponding
  versions with the literal VersionId string `null`, no delete markers or
  pending multipart uploads. The objects are precisely:
  `positive/qualification/iam-probe-da9db7129607-v1.txt` and
  `negative/qualification/iam-probe-da9db7129607-v1.txt`.
  Each is 27 bytes. Root inventory must **never** be reported as scoped IAM
  verification. Host report:
  `D:\gptdown\MCFT-CAP09-DA9-ROOT-READONLY-INVENTORY-20261017130828.json`,
  reported receipt SHA-256
  `3662522a439e52b6ef2fe164e26c03c245f9ca6158a345c9db664f4be9ad3a5e`.
- Verified local evidence ZIP (including both probe payloads and manifest):
  `D:\gptdown\MCFT-CAP09-da9db7129607-EVIDENCE-CUSTODY-EXPORT-V1\MCFT-CAP09-DA9-PROBE-EVIDENCE-20261016T170707Z.zip`,
  1456 bytes, SHA-256
  `6dbb1ffe417174dfc45450e695d0fd28cd2eacce0b85523a7a6c71d5f44ee62e`.
  This proves local source custody only; it is **not** independent remote WORM
  verification.

### Remote WORM identity remains unresolved

- The actual file `D:\gptdown\MCFT-CAP09-DA9-WORM-CUSTODY-V1.ps1` has
  **mandatory** `-Bucket`, `-Region`, and `-Profile` parameters, with
  default `KeyPrefix=geox/mcft/cap09/da9/evidence`. Its `put-object`,
  `head-object`, `get-object`, and `Set-Content` operations must **not**
  be rerun to reconstruct lost historical evidence.
- The purported historical WORM destination was
  `mcft-cap09-da9-evidence-worm-v1` with key
  `custody/mcft-cap09-da9-evidence-worm-v1/MCFT-CAP09-DA9-PROBE-EVIDENCE-20261016T170707Z.zip`,
  VersionId `f7dda227-652e-4dc7-ab97-c9d70874731d`,
  COMPLIANCE retention claimed through `2027-10-16T17:29:54.041Z`.
  **These are unverified historical claims**, notably inconsistent with the
  AWS script's default KeyPrefix. Do not silently reconcile them.
- Local export directory contained only the ZIP and `.sha256.txt`; the
  expected `DA9-WORM-CUSTODY-RECEIPT-*.json` file is **missing**.
  `aws configure list-profiles` displayed no configured profiles on the
  Windows host. The separate
  `D:\gptdown\MCFT-CAP09-DA9-LOCAL-WORM-V1.ps1` creates bucket/object-lock
  resources and ends `INDEPENDENT_CUSTODY_RECEIPT=PENDING`, not a
  replacement for an independent retention receipt.
- Outcome: `WORM_ORIGINAL_RECEIPT_NOT_FOUND`,
  `WORM_REMOTE_READBACK_UNVERIFIED`, `SOURCE_DELETE_NOT_AUTHORIZED`.

### Safe recovery procedure (human-controlled, read-only)

1. Determine from an accountable provenance record whether the historical
   custody target is remote AWS S3 or local MinIO; verify the **exact endpoint,
   region, bucket, complete key, VersionId and authorized READ-ONLY identity**.
   An absent AWS profile is not proof the object does not exist. Never use
   guessed defaults or production root credentials to claim scoped access.
2. Once a responsible custodian has verified the destination, use **only**
   `aws s3api head-object`,
   `aws s3api get-object-retention`, and
   `aws s3api get-object` with explicit `--bucket`, `--key`,
   `--version-id`, `--region`, `--profile` and, for S3-compatible
   storage, its verified `--endpoint-url`. Fetch into an exclusively new
   local file outside any frozen Runtime; never upload or overwrite.
3. Require the returned VersionId equals the authorized expected version;
   verify server-side Object Lock `COMPLIANCE` and retention expiry from
   authenticated responses; hash the downloaded **bytes** and require exact
   SHA-256 `6dbb1ffe417174dfc45450e695d0fd28cd2eacce0b85523a7a6c71d5f44ee62e`.
   Metadata/ETag alone does not prove equal bytes. Record the HTTP command
   exit status, timestamp, source identifier and digests without credentials.
4. Save any resulting signed/verified JSON as **NEW INDEPENDENT READONLY
   RECHECK**, never as the missing historical original. Preserve negative
   results; no PASS banner unless every independent check actually passed.
   Lack of verified destination, permissions or match => HOLD.
5. A later **separately governed exact-object disposition** must enumerate
   both source IAM-probe keys, each literal `null` VersionId, hashes, fresh
   inventory and source evidence, with explicit deletion authority and a
   review of whether deleting unversioned objects is permitted. No
   WORM receipt by itself authorizes source deletion. Do not bypass
   `bucket_empty_including_versions_multipart`.

### New-subject Retry/Host path remains separate

- Existing `da9-retry-bundle.cjs` hardcodes the old subject
  `91835fa0997730c85c5f3869dd530f4c9a3ca82d`. A verified formal
  Adoption for `61ceb797721cbbe9d6a949832afd92910c351a00`
  cannot satisfy this old contract, and an old signed retry adjudication
  cannot be replayed against a new subject.
- Do **not** simply replace the constant. A versioned successor must bind
  exact protected main, qualified **installed** Runtime/Host verifier bytes,
  the historically fixed six evidence digests, fresh separately approved
  signed Retry Adjudication, host ID, run-scoped resources, immutable permit
  context, Provider causal availability and measured six-stage time budget.
  The old denial and UNKNOWN first Provider count must be retained.
- Required **negative tests**: old-subject signature replay; forged approval;
  altered six hashes; mismatched installed Host/verifier; expired Adoption;
  nonempty source bucket; legacy `null` VersionId mishandling; unauthorized
  role/ACL; expired Provider window; insufficient stage budget; reused
  nonce/attempt. All must remain HOLD, including on Windows.
- The older formal Adoption for new material expired
  `2026-10-17T08:42:09.570Z`; reissue only through authorized real
  signing custody in the execution window. Fresh post-disposition
  PostgreSQL/MinIO/ACL/provider readback, new Permit and official preflight
  remain mandatory before **any** six-stage TEST_ONLY launch.
- **No source delete, new Retry approval, Permit, or execution is authorized
  by this documentation change.** Frozen production behavior is untouched.

---

