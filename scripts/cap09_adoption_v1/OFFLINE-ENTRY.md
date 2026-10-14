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
