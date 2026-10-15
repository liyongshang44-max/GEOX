# PR #3704 review boundary addendum — 2026-10-15

This addendum supersedes the candidate-state descriptions below for code behavior only.
It does not adopt this revision or transfer the signed qualification of `674fca57`
to later bytes. New material bindings and adoption signatures must name the new subject.
No Retry Permit is issued or consumed by these changes.

## Signed Adoption and controller responsibility

A formal context is created only after verifying the independent ADOPTION signature,
fixed policy digest, subject, host/operator, validity, 54 check-definition revisions and
hashed evidence, the 55-check/zero-blocker proof, and exact installed/release material.
A signed evidence result is the issuer's attestation; the offline verifier does not
rerun that check or infer a PASS from ancestry. Synthetic tests prove rejection
semantics, not Provider success or scientific qualification of a live run.

The release inventory must now explicitly include all 13 stage/controller files in
`REQUIRED_STAGE_MATERIAL`. An internally consistent, validly signed inventory omitting
any one is rejected even if the file exists in the installed profile. Each installed
file must match the release hash. This closes the former implicit coverage assumption.

| Legacy adoption flag | Material and execution responsibility retained |
| --- | --- |
| `real_delay_controller_adopted` | Six-stage scheduler, delay adapter and four distinct stage entry files; signed plan fixes Producer, Timing 1–3, delay, aggregate ordering and budgets. |
| `stage_capability_adopted` | Parent dispatcher, stage capability and receipt modules; separate Retry Permit consumption and child ticket consumption remain mandatory. |
| `real_provider_transport_delay_adopted` | Response-delay implementation and Producer entry; response-delay plan is bound to Run ID, subject, first base and timeout in permit-signed observations. |
| `real_pipeline_delay_adopted` | Pipeline-delay implementation; promotion/readback delay plan remains validated and bound to the same observations and budget. |

Both parent and child call the same controller gate before consuming authority.
The migrated gate accepts only an object registered by the formal verifier's WeakSet;
a copied object or caller-supplied booleans cannot replace it. Legacy mode still requires
all four adoption flags. Formal Adoption alone cannot satisfy `validateBundle`: the
independent Retry Permit, ARM, six-stage plan, current readback and exact resource
binding are additional conditions. The signature cannot confer Production authority.
This is TEST_ONLY implementation admission, not proof that a real Provider or delay
experiment has completed. The live six-stage receipt chain remains a separate result.

## Historical base recognition is not current qualification

`verifyPhase2HistoricalBase` is restricted to the retained Phase2 evidence base
`adfaf9fdbd2c75923fb298e26b5d5d106a0fc61a`, historical #3692 subject/base and a
non-executing historical boundary result. Git ancestry permits that evidence to remain
recognizable on later main; it does not adjudicate commits between the two SHAs.
The function explicitly returns `current_candidate_qualified=false` and
`execute_authorized=false`. The workflow still checks the exact evidence run, workflow,
subject, snapshot and reported PR base. Current changed-path ownership, dependency
changes, applicability and required check results remain independent gates.

The targeted test uses real local Git ancestry, then demonstrates that recognized
history plus an unknown current path fails, and that changing the pipeline controller
requires fresh qualification. Ancestry failure, wrong historical identity and authority
escalation are rejected. No full historical replay is needed for this test.

TEST_ONLY and Production remain HOLD pending review and new-subject adoption.

---

## Retained original candidate notes (historical; not current status)

# Offline real-host context candidate

This successor code changes the dispatcher/host integration, not the retained A44 archive.
The candidate is unadopted: `offline-trust.json.adopted=false`, no subject or issuers.
Existing real retry trust and all execution capability flags remain unchanged/disabled.
No live qualification or permit is issued by this module.

## Implemented path

The existing governed retry host selects offline proof consumption when
`MCFT_CAP09_ADOPTION_REQUEST` is present. The dispatcher rejects that marker on the
legacy path. Parent and child `hostBundle()` calls use the same offline verifier;
an invalid request never falls back to Git. With no marker, the existing path remains.
The fixed policy path is repository-owned; there is no caller-supplied trust option.

The signed Adoption envelope binds a precise subject, policy, host/operator, bounded
validity, 54 distinct versioned check decisions with original evidence byte hashes,
108-path and first-parent attestations, and installed-material profile digest.
These are signer attestations, not claims that local admission reruns history.
The policy must enumerate the actual required 54 checks and revisions on adoption;
the candidate contains none and rejects. Tests use artificial checks and test keys.

The compatibility `main` field means signed adopted subject in this path, explicitly
labelled `SIGNED_ADOPTION_NOT_LIVE_REMOTE_MAIN`. It is not a current GitHub query.
The original retry permit still verifies its ARM, observations and stage-plan
hashes and its own signer. `observed.adoption_binding` must contain the qualification
and material digests; its signature binding comes from the existing permit's
observations digest. Permit expiry cannot exceed qualification expiry. Existing
one-time parent consumption and child ticket consumption are unchanged.

## Material verification implemented

`installed-material.cjs` verifies an exact, nonempty file inventory under the
release root (including installed files placed there), rejects extra/missing/changed
files, links, hard-linked files, case collisions and special files. This candidate
requires a portable regular-file deployment: ordinary pnpm link trees are rejected,
not silently flattened or accepted. Inventory generation only reads files.
Node/Python/PowerShell executable paths and hashes are explicit; the current Node
binary must match. Interpreter identity is not inferred from a version string.
Outputs and permit ledger must be outside the immutable root.

Environment names are allowlisted. Search-path/public interpreter variables, when
present, must be exactly bound. Node/Python injection variables are rejected.
Only PATH/PATHEXT/SystemRoot/WinDir/MCFT_PYTHON_EXECUTABLE may be stored as public
values; DB/S3 credentials are never copied into the material profile. Their target
and permission contracts remain the existing signed runtime admission responsibility.

## Still open — do not activate on these tests

- Material file comparison is implemented; Windows installed material has NOT been
  collected or qualified by this change. No new Windows command is requested.
- Actual Node/tsx package export resolution, ancestor search roots, dynamic imports,
  native library/GRIB resolution and Python decoder interpreter selection still need
  a complete execution-profile proof. Binding a Python selftest interpreter alone
  does not prove every decoder uses it. better-sqlite3 applicability stays UNDETERMINED.
- Verification occurs in the host process. It is not an OS sandbox, pre-Node startup
  attestation, pre-import guard for all TS imports, or a TOCTOU immutability proof.
- Positive tests exercise signed offline context and material verification with
  synthetic evidence. Real dispatcher tests exercise disabled/rejected paths.
  A positive full six-stage execution via this new context is NOT yet proven.
- Actual 54-check Adoption adjudication, Windows integration, installed dependency
  closure and adoption of the successor remain required. Old A44 PASS cannot be
  transferred to these changed bytes without a successor release binding.

ENTRY-001: context-consumption seam implemented, acceptance/activation OPEN.
MATERIAL-001: exact material verifier implemented, installed closure OPEN.
APPLICABILITY-001: OPEN.
OS audit is separate. PostgreSQL/Windows selftests were not repeated.
TEST_ONLY and production HOLD remain.
