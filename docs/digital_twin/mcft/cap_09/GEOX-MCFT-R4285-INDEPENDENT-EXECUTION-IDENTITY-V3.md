# R4285 independent execution identity adapter

Local implementation based on frozen Subject `8be2552270049419974d415b1462333d698e4367` (tree `8f4bc25baeeb6658ebe3b46558bf43a645c504ae`). This document and the closed identity registration confer no execution authorization.

## Identity separation

| Object | Value |
|---|---|
| Registered successor execution Run | `d0b9e7614a25` |
| Execution ordinal | 5 (does not replace or relabel historical Attempt 4) |
| Original parent Run | `72dc0304a21a` |
| Direct failed predecessor Run | `4285c3ce342c` |
| Existing PG/MinIO resource Run | `4285c3ce342c` |
| Native installation qualification Run | `4285c3ce342c` (qualification only; no old execution authorization carried forward) |
| Successor nonce / Scope / approvals / Permit / Final | Not generated or issued |

The existing qualification consumers retain their original historical facts and signature domains. New source still requires qualification of its own Subject/material/release; existing signatures do not qualify modified source. Fresh execution signatures bind the successor Run and all existing exact digest bindings. An arbitrary caller-provided Run, environment override, old Run substitution, ordinal-4 Permit, or known failed execution nonce cannot select the successor authority. The real physical factory and atomic preparation reject every Run except `d0b9e7614a25`, before FD3 or reservation. Legacy Run recognition remains available only for read-only verification, historical qualification and ledger interpretation.

The resource names and labels remain the existing positive/negative PG databases, restricted roles, MinIO deployment and isolated Bucket. Only execution identity, output ownership and consumption slots change. `isolatedTargets` uses the explicitly registered resource mapping, including in actual stage children. No scheduler or scientific stage implementation is changed.

## Historical checks and atomic transition

The successor requires the predecessor Scope marker under the SAME repository-registered authority ledger root. Its schema, nonce, Scope and non-consumption status must match the sealed failed attempt. Any predecessor Run/nonce reservation requires review and blocks this recovery; no directory is removed, renamed or repaired. The predecessor marker's bytes are pinned at preparation and rechecked at the burn boundary. This is a continuity check, not a replacement for the full historical inventory/lineage verification.

New consumption uses `run-d0b9e7614a25` and global `nonce-<new nonce>` directories under that authority root. Exclusive mkdir/writeOnce and unforgeable in-process capabilities remain. Partial reservation burns the in-process capability and leaves partial disk state. Repeat consume or any repeat preparation after reservation fails. No automatic rollback or retry exists.

Scope/Source/Launch/Intent/Owner/Permit/Final keep exact signed execution identity. Stable is still native/in-process, minted only after native qualification and live Intent verification, with its unchanged 60-minute gate. Owner 120-second freshness, Final 15-second native recheck, Permit remaining-budget checks and the existing six-stage scheduler are unchanged.

One necessary handoff correction is included: the attached Producer carries the already validated factory execution mode into the formal source Launch recheck. Previously that call omitted the mode and defaulted to preflight-only validation, which would reject a physical Launch. This does not infer authorization from a new Run or bypass Launch verification.

## Local validation and limits

Node v24.22.1, offline only:

- Execution/signature/atomic/scheduler suite: successor-only guard included; final CI supplies the exact-head count. Includes successor synthetic six-child success and injected TIMING_2 failure, successor signed Scope/resource reuse, direct factory handoff, no duplicate consumption, fatal partial reservation, wrong identity/ordinal rejection, missing/changed predecessor history and predecessor reservations.
- Pinned CJS/ESM loading and separate-checkout historical-review regression: 2/2 PASS after adding the new dependency to their isolated release fixtures.
- git diff --check: PASS.

No real Windows acceptance or physical six-stage execution occurred. Tests use generated fixture keys and mocked external services; child-stage tests run synthetic local child scripts. They create no production signatures, resource account, execution nonce, Scope, Permit or Final.

The QCP73 identity successor owns exactly the original 17 paths plus six necessary governance/workflow paths, bound to base `8be2552270049419974d415b1462333d698e4367`, its exact tree and branch `mcft/r4285-v3-independent-execution-identity`. The first 72 definitions and all previous resolver registrations remain unchanged. The accepted native-tool qualification fixture is read at its immutable accepted merge, rather than treating the new diff as that historical PR. Positive and tampered base/tree/branch/head/path/history cases cover the new registration. Final exact-head CI/QCP and protected-main merge are required before installation. No Windows launch package is delivered by this patch.

Do not restore resource validity until this source closure and the necessary installation binding are ready. Do not rerun closed historical physical acceptance, alter old ledgers, or issue execution authority based on this local report. Once ready, recover only the minimum resource/qualification validity, obtain fresh explicit execution approval and allow one real TEST_ONLY run; accept actual 6/6 or N/6 plus the failure code and original evidence.
