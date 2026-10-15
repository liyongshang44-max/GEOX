# Real adoption evidence and release material binding V1

This milestone exports the actual Git objects for candidate
`a44b294f684027c0d1dd7a28c3735442fca736a4`. It does not qualify the later commit
containing these exporter tools, moving main, or a Windows installation. Rebinding
a new candidate requires explicit subject review and regeneration. No signature,
permit-consumption code or historical recursive verifier is changed.

## Deliverables

`adoption-evidence-manifest.json` contains:

- All **54 current QCP definitions**, their canonical SHA-256 revisions, source
  Git blobs, applicable stages and per-check registry records with exact JSON
  pointers and record hashes. With a captured CI log, the actual 54 CP2 planner
  decisions are also preserved. A planner decision is not an adoption result.
- The **52-check historical QCP at #3691**, original document bytes and one-to-one
  identity mappings into the current 54 checks. Changed revisions remain visible;
  identity mapping does not imply semantic equivalence.
- **65 default engineering entry cases**, expanded from the fixed entry-test
  source, with source anchors/line numbers and source SHA-256. The optional compile
  flag adds five cases; 65 is not the QCP's current check count. These are assertion
  mappings, not invented per-case execution receipts.
- **108 frozen paths**, current blob/SHA-256 and the original frozen blob identity.
  Matching bytes may PASS this narrow identity check only.
- **31 first-parent commits**, raw Git commit objects and hashes, plus the original
  merge's second-parent object. Offline review checks chain continuity and original
  first-parent/merge-tree identities. Complete historical assertions remain BLOCKED.

The registry's claimed PASS, declared artifact ZIP digest and dependency digest
are retained as declarations. The exact raw registry document is available, but
that does **not** mean the referenced original artifact bytes were obtained.
Every current QCP adoption conclusion remains BLOCKED until original evidence
and exact-subject applicability/inheritance are adjudicated. No overall PASS can
be issued from this manifest. Existing historical successes have not been revoked;
their migration into this candidate's proof remains unadjudicated.

`release-material-binding.json` binds **6,414 files** from actual candidate Git
objects: executable source/support, package declarations and locks, configuration,
migration SQL, authority/evidence JSON, and seven execution entrypoints. The
inventory is a conservative repository-source superset, not a minimal dependency
closure. Every row includes path, category, size, Git blob SHA, SHA-256 and Git mode.
The verifier checks file content; Git mode is provenance, not a Windows ACL test.

`payload/` is the release source package. `evidence/` holds adoption evidence and
original source/registry/commit records. Some docs JSON are **dual-role**: existing
code reads them at runtime, so they remain bound inside the payload as well as
being referenced as evidence. Descriptive Markdown and unrelated docs images are
outside runtime scope. Unrelated docs edits do not alter this scoped file inventory.
The adoption manifest hashes the release binding; `summary.json` records both
artifact digests. Those digests need a separately reviewed qualification proof
before they can be treated as execution trust anchors.

## Commands (no database, Provider or MinIO access)

Build on an adoption workstation with the fixed commit and historical Git objects
already available. This performs local Git object reads only; it never clones,
fetches, checks out historical worktrees, or executes QCP validators:

```text
python -B scripts/cap09_adoption_v1/build_evidence.py --repo <repository> --subject a44b294f684027c0d1dd7a28c3735442fca736a4 --output <new-output-directory>
```

For this reviewed capture, optional `--ci-capture <directory>` accepts the retained
GitHub job metadata and decoded log (`capture.json` specifies `log_file`). It
preserves both and derives timestamp-stripped CP2 JSON for the exact subject. It
does not claim the derived JSON has the original uploaded artifact's SHA-256.
The capture associated with run **38442436228**, job **115452167618**, records
`CP2_SUCCESSOR_CHAIN_CANDIDATE_UNKNOWN_PATH` and
`CP2_SUCCESSOR_CHAIN_UNKNOWN_OUTSIDE_ACCEPTED_ANCHOR`. This is the candidate's
observed CI failure, separate from the older Phase2 failure reported in the ADR.

On a verifier machine, Python alone suffices; Git and internet are not used:

```text
python -B scripts/cap09_adoption_v1/evidence_review.py --root <package> --trusted-sha256 <reviewed-adoption-manifest-sha256>
python -B scripts/cap09_adoption_v1/material_binding.py --root <package/payload> --manifest <package/release-material-binding.json> --trusted-sha256 <reviewed-release-binding-sha256> --subject a44b294f684027c0d1dd7a28c3735442fca736a4 --loaded-path <absolute-path-to-intended-entrypoint>
```

Do not take the trusted digest from an untrusted manifest supplied with the files
being checked. `--loaded-path` checks the actual path and bytes presented to it;
it is not an automatic Node module-load tracer or evidence that execution occurred.
Extra/missing scoped files, byte drift, unbound/outside loaded paths, path traversal
and duplicate/case-colliding entries are rejected. Exact bytes are required;
Windows CRLF conversion is not silently normalized.

## Explicit remaining boundaries

- `node_modules` is deliberately not treated as verified merely because the lock
  file matches. Installed package bytes, Node/native binaries, Python/GRIB tools,
  actual module load traces and effective host configuration remain BLOCKED.
- The offline verifier checks an immutable package at one instant. Windows launcher
  integration must enforce the trusted release root and prevent post-check changes.
  This tool alone does not establish that the same bytes are subsequently executed.
- Resource endpoints, principals, buckets and ACL observations will come from the
  next Windows read-only collector; no already-passed PostgreSQL probe is repeated.
- The legacy CP2 applicability registration remains a real blocker. This change
  records it and does not weaken its assertion or rewrite history to make it pass.
- New workflow results validate these tools and source bindings. They cannot be
  counted as legacy ALL_BLOCKERS PASS, real Adoption PASS, TEST_ONLY authorization
  or production authorization.

The output directory is exclusive. A failed build preserves partial output and
requires a new directory; there is no cleanup of an existing audit package.
