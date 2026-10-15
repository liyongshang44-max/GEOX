# A44 real-entry and release-material boundary decision

Subject: `a44b294f684027c0d1dd7a28c3735442fca736a4`.
Reviewed engineering head: `00df7341bd4bda6e61caaa2a23d6842de74f33c3`.

## Decision

Source boundary review is complete. Execution-material qualification is incomplete.
All 6,414 payload files were independently hashed against release manifest
`099ae7f99547c68f754f4076020505d5fbff35198da160b526101640e56a1c4a`.
Seven entry files match. This is a local byte check of retained A44 materials, not a new Windows deployment check.
The adjacent JSON records exact entry hashes and source-line evidence.

The Windows wrapper selects `node` through shell resolution and dispatches the existing CJS runner. Its governed-retry path invokes the host. The host fixes six stages: Producer, three invocations of the same Timing file, Controlled Delay, Aggregate. Child Node processes use `process.execPath`; TS stages use `--import tsx`. Python selftest executable selection remains environment/PATH-dependent; the GFS decoder also has a configurable interpreter. Repository Python script bytes do not bind interpreter/native-library bytes.

## Registered engineering gaps

- **CAP09-ENTRY-001 — OPEN:** offline Admission is not connected to the real entry chain. `hostBundle()` still calls `sourceContext()`, including remote `git ls-remote`, local history and frozen-path checks. The existing offline verifier is synthetic-only. The release payload is not a Git checkout, so source byte verification alone does not satisfy this entry contract. Do not remove the old checks without adopting their proof-consuming replacement.
- **CAP09-MATERIAL-001 — OPEN:** installed executables, `tsx`, `pg`, transitive/native dependencies and actual resolution/environment are not covered by the 6,414-file source manifest. Prior bounded PG-load evidence is useful but does not close the entire loader boundary.
- **CAP09-APPLICABILITY-001 — OPEN:** `better-sqlite3` remains UNDETERMINED for the complete execution profile. Existing static evidence does not find it reachable, which neither establishes mandatory installation nor proves universal non-reachability.

The JSON gives a concrete exit criterion for each gap. This record does not invent a new historical acceptance stage and does not modify the frozen Runtime, trust configuration or permit protocol.

## Scope and implementation boundary

Package contents, dependency declarations/lockfiles and authority JSON read by code are source materials. Adoption raw evidence is proof material. Installed dependencies, interpreter binaries, host configuration and resource identity are execution-environment materials and need their own binding. A lockfile is not proof that installed bytes match it.

A successor launcher must validate adopted proof and bound material before operational imports/dispatch, and pass admission/stage authority to children. Checking NODE_OPTIONS inside an already-started Node process does not by itself prove absence of pre-entry loading. The current host's environment rejection remains useful but is not a whole-process side-effect attestation. No bypass exploit or OS mutation was attempted.

The 16 previously flagged process boundaries were classified in the existing triage; classification is not complete AST/package reachability. Do not reopen all 16 as unidentified defects and do not promote their classification into a safe-execution PASS.

PostgreSQL checks and Windows selftests were not rerun. OS side-effect attestation is a separate unresolved work item; it is not a prerequisite to completing source/material analysis. Its eventual relevance to execution safety must still be adjudicated. The 54 Adoption checks remain outside this limited decision and are not promoted to PASS.

Single accountable operator signing is permitted; signing and verification remain distinct workflows. No second human signer is introduced as a requirement.

TEST_ONLY EXECUTE_HOLD and PRODUCTION HOLD remain. No permission issued or consumed, no Producer run, no production operation.
