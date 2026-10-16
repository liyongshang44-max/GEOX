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

- Main's formal Adoption signer/verifier still require INDEPENDENT_GOVERNANCE.
  This candidate does not override that policy or pretend the registered
  ACCOUNTABLE_SINGLE_OPERATOR retry key satisfies formal Adoption. A reviewed
  scope-specific policy/code successor is needed for that route.
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

Frozen Host compatibility remains **unimplemented**. The frozen Host loads its
own offline verifier, including in child-stage admission. A context produced by
an external module cannot replace that verifier's private verified-context set.
A passing external verification alone therefore cannot establish actual Host
admission. No module-cache injection, preload or frozen-file replacement is used.
A separately qualified execution-material integration is required before this
bundle can be admitted by the real Host.

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
