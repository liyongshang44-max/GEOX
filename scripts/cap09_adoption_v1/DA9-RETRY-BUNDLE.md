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
