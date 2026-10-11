# CAP-09 disabled retry implementation — EXECUTE HOLD

Engineering base: `c9e027b832d1e25a20384d4853ed5564ed405fd4` (PR #3689).
Candidate input: PR #3690, commit `2d42bd1363200774b4a044fb016fe3b4bf3bffad`,
`MCFT-CAP09-ISOLATED-RETRY-AUTHORITY-SUCCESSOR-CANDIDATE-20261011.md`.
The candidate is not adopted authority. This is its separate implementation
proposal, not activation and not a declaration of qualification recovery.

## Delivered boundary

- Independent JSON ARM, strictly disabled. New run identity, ordinal, clocks,
  exact-main binding, resources, output directory and retry adjudication are
  null. All execution, retry and production-effect flags are false.
- The three available first-attempt evidence hashes are immutable anchors.
  V2/V6 reviewed hashes are null, not guessed. First Provider call count stays
  unknown (`null`). The old ARM and all failed receipts are untouched.
- A read-only CLI validates the exact disabled artifact. It exits **2** with
  `EXECUTE_HOLD`; malformed/changed artifacts or override arguments exit 1.
  Flipping `armed` in the worktree cannot activate this implementation.
- A pure proposal assessor implements negative admission conditions. Its
  success is `PROPOSAL_PRECONDITIONS_PASS_NOT_EXECUTION_AUTHORITY` and STILL
  returns `execute_authorized=false`, `retry_authorized=false`. Tests use
  synthetic 2030 fixtures, never live evidence or credentials.
- The operational qualification runner is not connected to this assessor.
  No activation path is delivered. The old first-base/expiry gates remain in
  force. A later reviewed activation successor must resolve authority
  provenance, exact-main binding and runtime integration; no JSON edit or
  function return here is a permit to run.

## Proposed admission rules implemented for review

Require exact head = protected main = adjudicated subject, clean source,
Windows post-merge proof, zero QCP blockers, the prior 51 checks and 108 frozen
paths; strict first-base > authorization time + 6h AND > execution time + 6h;
expiry after first-base and now, at most 24h after authorization. A separate
explicit retry adjudication must supersede the old denial and acknowledge the
unknown first Provider count and unresolved failure phase.

The implementation proposes **a new run ID**, preserving parent lineage
`72dc0304a21a` and retry ordinal 2; old resource identities are not silently
reused. It also proposes a **five-minute maximum fresh-readback age**, measured
from readback start, after authorization. These are conservative implementation
choices for review, not claims that PR #3690 already authorized them.

Resources are exact run-scoped databases on `127.0.0.1:55432`, audited as
`qual_admin`, and a run-scoped bucket on `http://127.0.0.1:59000`. Require both
29-table readbacks to pass with all rows zero, and complete non-truncated zero
counts for objects, versions, delete markers and multipart uploads. Owner
isolation, no production bindings, original evidence preservation, every
reviewed evidence digest and a new absolute output directory absent both on
disk and from the attempt ledger are mandatory proposal observations.

Observations are input data, NOT independently authenticated by the pure
assessor. A future activation implementation must collect/verify them on the
Windows host and establish the provenance of the reviewed adjudication.
Caller-supplied booleans/hashes alone never grant authority here.

## Inheritance and validation

Exactly ten engineering paths are allowed. Existing 51 QCP check records and
resolvers are preserved byte-equivalently as parsed data; one disabled-policy
engineering check is added. The prior verifier changes only by an exact
successor route. Its full adopted #3689 history is replayed from immutable Git
source. Original ARM, execution source, Producer, frozen Runtime, production
schema, bucket and evidence files are outside the allowed diff.

Candidate and post-merge admission require exact paths, ancestry, two-parent
zero-delta adoption and historical PASS. CI tests stale subjects, clocks,
expiry, missing retry adjudication, effects/modes, evidence mismatches,
unknown counts, resource identity, incomplete readbacks and output reuse.
No CI Provider, PostgreSQL or object writes are performed by these tests.

After required CI/QCP and reviewed merge, Windows must revalidate exact-main
engineering and the disabled ARM. This is separate from any later activation
decision or fresh live readback. Do not run the old `--execute-once` operator
scripts to test this implementation.

**Disposition: DISABLED_IMPLEMENTATION_CANDIDATE / ACTIVATION_NOT_IMPLEMENTED /
AUTHORIZATION_NOT_ADOPTED / EXECUTE_HOLD.**
