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

## DA9 WORM remote status — evidence checkpoint, 2026-10-17

**Current operator-verified remote result:** `WORM_REMOTE_READONLY_RECHECK=PASS`.
The original historical upload receipt is missing; this independent readback is
a separate, newly generated receipt and must not be backdated.

- DA9 isolated MinIO endpoint: `http://127.0.0.1:59005`.
- Archived object: bucket `mcft-cap09-da9-evidence-worm-v1`,
  **actual key** `MCFT-CAP09-DA9-PROBE-EVIDENCE-20261016T170707Z.zip`
  (no `custody/` prefix), exact VersionId
  `f7dda227-652e-4dc7-ab97-c9d70874731d`.
- Independently retrieved Object Lock mode: `COMPLIANCE`;
  expiry `2027-10-16T17:29:54.041Z`.
  Version-specific download SHA-256 matched the original 1456-byte ZIP:
  `6dbb1ffe417174dfc45450e695d0fd28cd2eacce0b85523a7a6c71d5f44ee62e`.
- New Windows read-only receipt:
  `D:\gptdown\MCFT-CAP09-DA9-WORM-READONLY-RECHECK-47e648ddd8be4ad688aacfe9f73307d1\independent-readonly-recheck.json`.
  Windows host reported receipt-file SHA-256
  `6a26a91fe10d0a67bcbdf0509261101dfeae3c7bbef22292f6d3f43b85694d81`.
  The **receipt bytes are not committed** and cannot yet be rehashed from GitHub.
- Historical AWS CLI WORM script requires explicitly provided Bucket/Region/Profile
  and defaults to an unrelated KeyPrefix. It is effectful and must not be rerun.
  Historical custody-prefix locator was wrong. The new verified locator above
  is authoritative for this particular object version.

Actual source bucket `mcft-cap09-requal-da9db7129607` currently contains
two 27-byte IAM qualification probes, one positive and one negative, each
reported VersionId string `null`; versions=2, delete markers=0,
multipart=0. Positive and negative PostgreSQL each had 29 public tables,
zero rows under a read-only `qual_admin` audit. These are historical snapshots,
not a future Admission readback.

**No source deletion authorized.** The exact two-probe
`MCFT-CAP09-DA9-EXACT-PROBE-DISPOSITION-UNSIGNED-DRAFT-20261017.json`
is an unsigned review input, not an approval. It still lacks per-object
independently validated SHA-256, current pre-disposition inventory, approver
identity and verifiable approval. Both probes remain untouched.

**Retry/Host implementation belongs ONLY to PR #3713.** This PR #3714 is
WORM evidence and disposition documentation, no runnable admission gates or
CI changes. Never substitute a boolean `signature_verified=true` for
cryptographic verification; do not migrate signatures from old Subject
`91835fa0...` to new Subject `61ceb797...`.

Previous Adoption expiry timestamp was `2026-10-17T08:42:09.570Z`
(**Beijing time 2026-10-17 16:42:09.570**). As of the local
2026-10-17 ~14:18 Beijing checkpoint it was **not yet expired**;
all execution windows must assess expiry relative to actual current time,
and re-sign only if the approved proof is no longer valid.

No WORM operation, source deletion, Retry sign, Permit or six-stage execution
was performed by this documentation-only change.

---

